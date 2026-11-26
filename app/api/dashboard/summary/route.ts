import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { packagesFor } from "@/lib/packageViews";
import { mentorPayoutSummary } from "@/lib/payouts";
import { payoutAccountStatus } from "@/lib/stripeAccountStatus";
import { profileFieldsSelect, profileProgress } from "@/lib/profileCompleteness";
import { hasAvailability } from "@/lib/schedule";
import { formatHasCall } from "@/lib/options";

export const dynamic = "force-dynamic";

const DAY = 24 * 3600_000;

// Whether the mentor's Stripe account can receive payouts (the same check
// as /api/stripe/status, lib/stripeAccountStatus.ts).
async function payoutStatus(stripeAccountId: string | null | undefined) {
  if (!stripeAccountId) return { connected: false, started: false };
  try {
    const s = await payoutAccountStatus(stripeAccountId);
    return { connected: !s.error && s.ready, started: true };
  } catch {
    return { connected: false, started: true };
  }
}

// Everything the mentor Home needs in one request (it used to make seven):
// profile progress, payouts status, earnings, packages, offers, students
// waiting on a reply and the next week's calls. `?for=settings` returns
// only what Settings needs (payouts status and the active package count).
export async function GET(req: Request) {
  const session = await getSession();
  const user = session?.user as any;
  if (!user || user.role !== "SELLER") return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const userId: string = user.id;
  const forSettings = new URL(req.url).searchParams.get("for") === "settings";

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, stripeAccountId: true, hourlyRateCents: true, weeklyHours: true, ...profileFieldsSelect },
  });
  if (!me) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (forSettings) {
    const [payouts, activePackages] = await Promise.all([
      payoutStatus(me.stripeAccountId),
      prisma.order.count({ where: { sellerId: userId, status: { in: ["IN_ESCROW", "COMPLETED"] } } }),
    ]);
    return NextResponse.json({ payouts, activePackages });
  }

  const now = new Date();
  const [payouts, earnings, packages, gigs, convos, calls] = await Promise.all([
    payoutStatus(me.stripeAccountId),
    mentorPayoutSummary(userId),
    packagesFor(userId, "SELLER"),
    prisma.gig.findMany({ where: { sellerId: userId, OR: [{ active: true }, { kind: "HOURLY" }] }, select: { kind: true, format: true }, take: 500 }),
    prisma.conversation.findMany({
      where: { sellerId: userId },
      select: { id: true, sellerUnread: true, buyer: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.callBooking.findMany({
      where: {
        status: "BOOKED",
        endTime: { gt: now },
        startTime: { lt: new Date(now.getTime() + 7 * DAY) },
        OR: [{ order: { sellerId: userId, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } } }, { kind: "INTRO", mentorId: userId }],
      },
      select: {
        id: true, startTime: true, endTime: true, orderId: true, kind: true,
        order: { select: { packageTitle: true, gig: { select: { title: true } }, buyer: { select: { name: true } } } },
        student: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
      take: 200,
    }),
  ]);

  // Students waiting on a reply: the last message is theirs, and it's
  // unread or from the last 7 days.
  const waiting = convos
    .filter((c) => {
      const last = c.messages[0];
      return last && last.senderId !== userId && (c.sellerUnread > 0 || now.getTime() - last.createdAt.getTime() < 7 * DAY);
    })
    .map((c) => ({ conversationId: c.id, studentName: c.buyer?.name || "", lastAt: c.messages[0].createdAt }));

  return NextResponse.json({
    profile: { id: me.id, name: me.name, hourlyRateCents: me.hourlyRateCents, hasAvailability: hasAvailability(me.weeklyHours), progress: profileProgress(me as any) },
    payouts,
    earnings: { unpaidCents: earnings.unpaidCents, heldCents: earnings.heldCents, nextPayoutDay: earnings.nextPayoutDay, payoutsConnected: earnings.payoutsConnected },
    packages,
    offers: { hasExtras: gigs.some((g) => g.kind === "BUNDLE" || g.kind === "SPECIALIZED"), hasCallOffer: gigs.some((g) => formatHasCall(g.format)) },
    waiting,
    upcoming: calls.map((b) => ({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      orderId: b.orderId,
      kind: b.kind,
      title: b.order ? b.order.packageTitle || b.order.gig.title : "Free 15-minute intro call",
      withName: (b.order ? b.order.buyer.name : b.student?.name) || "",
    })),
  });
}
