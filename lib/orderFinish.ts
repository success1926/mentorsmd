// Finishing hours orders on the server: "Mark work complete", the
// student's answer, and the 48-hour auto-approval. The rules are in
// lib/finishing.ts. Server only.
import { prisma } from "@/lib/prisma";
import { StudentAction, autoApprovePatch, markCompleteBlocker, markCompletePatch, studentActionPatch } from "@/lib/finishing";
import { SITE_URL, sendLastRequestEmail, sendPackageApprovedEmail, sendWorkMarkedCompleteEmail } from "@/lib/email";

export class FinishError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const include = {
  gig: { select: { title: true } },
  buyer: { select: { name: true, email: true } },
  seller: { select: { name: true, email: true } },
  callBookings: { select: { status: true, endTime: true } },
} as const;

async function load(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include });
  if (!order || !order.kind) throw new FinishError("Package not found", 404);
  return order;
}
type Loaded = Awaited<ReturnType<typeof load>>;
const title = (o: Loaded) => o.packageTitle || o.gig.title;
const url = (o: Loaded) => `${SITE_URL}/orders/${o.id}`;

// The fields a change was decided on: the update only applies if none of
// them changed meanwhile (a dispute, another click, the cron).
const unchanged = (o: Loaded) => ({
  id: o.id,
  status: o.status,
  disputed: o.disputed,
  markedCompleteAt: o.markedCompleteAt,
  approvedAt: o.approvedAt,
  lastCallUsedAt: o.lastCallUsedAt,
  lastRevisionUsedAt: o.lastRevisionUsedAt,
});

export async function markWorkComplete(orderId: string, mentorId: string) {
  const order = await load(orderId);
  if (order.sellerId !== mentorId) throw new FinishError("Only the mentor on this package can mark it complete", 403);
  const now = new Date();
  const upcomingCalls = order.callBookings.filter((b) => b.status === "BOOKED" && b.endTime > now).length;
  const blocked = markCompleteBlocker({ ...order, upcomingCalls });
  if (blocked) throw new FinishError(blocked);
  const patch = markCompletePatch(now);
  const res = await prisma.order.updateMany({ where: unchanged(order), data: patch });
  if (!res.count) throw new FinishError("This package just changed. Refresh the page.", 409);
  await sendWorkMarkedCompleteEmail(order.buyer.email, { mentorName: order.seller.name, packageTitle: title(order), deadline: patch.responseDeadline, orderUrl: url(order) }).catch((err) =>
    console.error("Marked-complete email failed", err)
  );
}

export async function studentResponds(orderId: string, studentId: string, action: StudentAction, note: string) {
  const order = await load(orderId);
  if (order.buyerId !== studentId) throw new FinishError("Only the student on this package can do this", 403);
  const result = studentActionPatch(order, action, note);
  if ("error" in result) throw new FinishError(result.error);
  const res = await prisma.order.updateMany({ where: unchanged(order), data: result.patch });
  if (!res.count) throw new FinishError("This package just changed. Refresh the page.", 409);
  if (result.approved) {
    await approvedEmails(order, false);
  } else {
    await sendLastRequestEmail(order.seller.email, {
      studentName: order.buyer.name,
      request: action === "LAST_CALL" ? "one last call" : "one last revision",
      packageTitle: title(order),
      note,
      orderUrl: url(order),
    }).catch((err) => console.error("Last-request email failed", err));
  }
}

async function approvedEmails(order: Loaded, auto: boolean) {
  const base = { packageTitle: title(order), studentName: order.buyer.name, mentorName: order.seller.name, auto, orderUrl: url(order) };
  await sendPackageApprovedEmail(order.buyer.email, { ...base, forMentor: false }).catch((err) => console.error("Approved email failed", err));
  await sendPackageApprovedEmail(order.seller.email, { ...base, forMentor: true }).catch((err) => console.error("Approved email failed", err));
}

// An admin approves a package (e.g. to settle a dispute in the mentor's
// favour): no money moves now; it's paid with the monthly payout.
export async function adminApprove(orderId: string) {
  const order = await load(orderId);
  if (order.status !== "IN_ESCROW" || order.approvedAt) throw new FinishError("This package isn't open");
  const now = new Date();
  const res = await prisma.order.updateMany({
    where: unchanged(order),
    data: {
      status: "COMPLETED",
      approvedAt: now,
      completedAt: now,
      autoApproved: false,
      responseDeadline: null,
      ...(order.disputed ? { disputeResolvedAt: now, disputeResolution: "RELEASED" } : {}),
    },
  });
  if (!res.count) throw new FinishError("This package just changed. Refresh the page.", 409);
  await approvedEmails(order, false);
  return order;
}

// Cron: approves packages whose 48 hours have passed with no answer
// (never one with an open dispute).
export async function runAutoApprovals(now: Date = new Date()) {
  const results = { approved: 0, errors: 0 };
  const due = await prisma.order.findMany({
    where: { kind: { not: null }, status: "IN_ESCROW", disputed: false, approvedAt: null, markedCompleteAt: { not: null }, responseDeadline: { lte: now } },
    include,
    orderBy: { responseDeadline: "asc" },
    take: 100,
  });
  for (const o of due) {
    try {
      const res = await prisma.order.updateMany({ where: { ...unchanged(o), responseDeadline: { lte: now } }, data: autoApprovePatch(now) });
      if (!res.count) continue;
      results.approved++;
      await approvedEmails(o, true);
    } catch (err) {
      console.error("Auto-approve failed", o.id, err);
      results.errors++;
    }
  }
  return results;
}


