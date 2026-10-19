// MentorsMD credit given by admins (redesign Oct 2026, docs/redesign-2026-10.md
// section 6): "Refund as credit" when settling a dispute, and manual
// adjustments in Admin -> People. The ledger itself is lib/credit.ts.
// Server only.
//
// Refund as credit (hours packages with an open dispute):
//   - Any amount from $0.01 up to everything the student paid for the
//     package: its price plus paid "Add hours" top-ups, including the part
//     they paid with credit.
//   - The student gets a CreditEntry (reason DISPUTE_REFUND, the admin, the
//     package) and the "MentorsMD credit added" email.
//   - The package closes: a full refund marks it Refunded (nothing more is
//     paid to the mentor); a partial refund approves it, and the refund is
//     taken off the mentor's final payout for it (lib/payoutRules.ts:
//     unpaid + unused hours at the package rate, minus the refund, never
//     below zero). Calls still booked on it are cancelled.
import { prisma } from "@/lib/prisma";
import { creditBalance, lockCredit } from "@/lib/credit";
import { logAdminAction } from "@/lib/adminLog";
import { closeDisputeFlag } from "@/lib/flags";
import { sendCreditIssuedEmail } from "@/lib/email";
import { money } from "@/lib/options";

export class CreditError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const CREDIT_ADJUST_MAX_CENTS = 1_000_000; // $10,000 per adjustment

// The most that can be refunded as credit on a package.
export function refundableCents(o: { amount: number; topUps: { amountCents: number }[]; creditEntries: { amountCents: number }[] }) {
  const paid = o.amount + o.topUps.reduce((s, t) => s + t.amountCents, 0);
  const already = o.creditEntries.reduce((s, c) => s + c.amountCents, 0);
  return Math.max(0, paid - already);
}

export async function refundAsCredit(orderId: string, admin: { id: string; name: string }, amountCents: unknown, note: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      gig: { select: { title: true } },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { name: true } },
      topUps: { where: { status: "PAID" }, select: { amountCents: true } },
      creditEntries: { where: { reason: "DISPUTE_REFUND" }, select: { amountCents: true } },
    },
  });
  if (!order || !order.kind) throw new CreditError("Package not found", 404);
  if (!order.disputed || order.disputeResolvedAt || order.status !== "IN_ESCROW") throw new CreditError("Refund as credit is for packages with an open dispute.");
  const max = refundableCents(order);
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents < 1) throw new CreditError("Enter the amount to refund as credit.");
  if (amountCents > max) throw new CreditError(`At most ${money(max)} can be refunded on this package (what the student paid).`);
  const full = amountCents === max;
  const now = new Date();
  const title = order.packageTitle || order.gig.title;

  await prisma.$transaction(async (tx) => {
    await lockCredit(tx, order.buyerId);
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "IN_ESCROW", disputed: true, disputeResolvedAt: null },
      data: full
        ? { status: "REFUNDED", refundedAt: now, disputeResolvedAt: now, disputeResolution: "CREDIT", markedCompleteAt: null, responseDeadline: null }
        : { status: "COMPLETED", approvedAt: now, completedAt: now, autoApproved: false, responseDeadline: null, disputeResolvedAt: now, disputeResolution: "CREDIT" },
    });
    if (!claim.count) throw new CreditError("This package just changed. Refresh the page.", 409);
    await tx.creditEntry.create({
      data: { userId: order.buyerId, amountCents, reason: "DISPUTE_REFUND", note: note.trim().slice(0, 500) || "Refunded as credit to settle a dispute", orderId: order.id, adminId: admin.id },
    });
  });

  // A closed package keeps no future calls.
  await prisma.callBooking
    .updateMany({ where: { orderId: order.id, status: "BOOKED", startTime: { gt: now } }, data: { status: "CANCELLED", cancelledAt: now, cancelledById: admin.id } })
    .catch((e) => console.error("Couldn't cancel calls on a refunded package:", e));

  await logAdminAction({
    adminId: admin.id,
    action: "ORDER_CREDIT_REFUND",
    summary: `Refunded ${money(amountCents)} as MentorsMD credit on ${title} (${full ? "full refund" : `partial; the rest is paid to ${order.seller.name}`}) to settle a dispute`,
    targetType: "ORDER",
    targetId: order.id,
    targetUserId: order.sellerId,
    details: { amountCents, full, note: note || undefined },
  });
  await closeDisputeFlag(order.id, "REFUND", admin.id);
  const balance = await creditBalance(order.buyerId);
  await sendCreditIssuedEmail(order.buyer.email, {
    name: order.buyer.name,
    amount: money(amountCents),
    packageTitle: title,
    note: note.trim() || "Refunded as credit to settle your dispute.",
    balance: money(balance),
  }).catch((err) => console.error("Credit email failed", err));
  return { full, amountCents, balanceCents: balance };
}

// Admin -> People -> a student: add (+) or remove (-) credit, with a reason.
export async function adjustCredit(userId: string, admin: { id: string }, amountCents: unknown, reason: string) {
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents === 0) throw new CreditError("Enter an amount to add or remove.");
  if (Math.abs(amountCents) > CREDIT_ADJUST_MAX_CENTS) throw new CreditError(`At most ${money(CREDIT_ADJUST_MAX_CENTS)} at a time.`);
  const why = reason.trim();
  if (!why) throw new CreditError("Say why (the reason is saved in the action log).");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!user || user.role !== "BUYER") throw new CreditError("Credit is for student accounts.", 404);

  const balance = await prisma.$transaction(async (tx) => {
    await lockCredit(tx, userId);
    const before = await creditBalance(userId, tx);
    if (before + amountCents < 0) throw new CreditError(`Their balance is ${money(before)}, so at most that can be removed.`);
    await tx.creditEntry.create({ data: { userId, amountCents, reason: "ADMIN_ADJUST", note: why.slice(0, 500), adminId: admin.id } });
    return before + amountCents;
  });
  await logAdminAction({
    adminId: admin.id,
    action: "CREDIT_ADJUST",
    summary: `${amountCents > 0 ? "Added" : "Removed"} ${money(Math.abs(amountCents))} of MentorsMD credit ${amountCents > 0 ? "to" : "from"} ${user.name}: ${why}`.slice(0, 500),
    targetType: "USER",
    targetId: user.id,
    targetUserId: user.id,
    details: { amountCents, reason: why, balanceAfterCents: balance },
  });
  if (amountCents > 0) {
    // The reason is for the team (action log), so it isn't put in the email.
    await sendCreditIssuedEmail(user.email, { name: user.name, amount: money(amountCents), balance: money(balance) }).catch((err) => console.error("Credit email failed", err));
  }
  return { balanceCents: balance };
}
