import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { hoursSummary } from "@/lib/hours";
import { refundableCents } from "@/lib/creditAdmin";

export const dynamic = "force-dynamic";

// Both lists for the admin page: disputes still waiting on a decision,
// and recently resolved ones (refunded, refunded as credit, or released /
// approved for the mentor).
export async function GET() {
  const admin = await currentAdmin("disputes");
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const include = {
    gig: { select: { id: true, title: true } },
    buyer: { select: { name: true, email: true } },
    seller: { select: { name: true, email: true } },
    // Everything the mentor delivered, so the admin can judge the work.
    deliveries: { orderBy: { number: "asc" as const } },
    // Hours packages: the hours log, paid top-ups and any credit refunded.
    hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true, payoutId: true } },
    callBookings: { select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true } },
    topUps: { where: { status: "PAID" }, select: { amountCents: true, creditAppliedCents: true, minutes: true } },
    creditEntries: { where: { reason: "DISPUTE_REFUND" }, select: { amountCents: true } },
  };

  const [open, resolved] = await Promise.all([
    prisma.order.findMany({
      where: { disputed: true, disputeResolvedAt: null, status: { in: ["IN_ESCROW", "COMPLETED"] } },
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { disputed: true, OR: [{ disputeResolvedAt: { not: null } }, { status: { in: ["RELEASED", "REFUNDED"] } }] },
      include,
      orderBy: [{ disputeResolvedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const shape = (o: (typeof open)[number]) => {
    if (!o.kind) return o;
    const h = hoursSummary(o);
    const topUpCents = o.topUps.reduce((s, t) => s + t.amountCents, 0);
    return {
      ...o,
      title: o.packageTitle || o.gig.title,
      paidCents: o.amount + topUpCents,
      topUpCents,
      creditUsedCents: o.creditAppliedCents + o.topUps.reduce((s, t) => s + t.creditAppliedCents, 0),
      refundedCreditCents: o.creditEntries.reduce((s, c) => s + c.amountCents, 0),
      refundableCents: refundableCents(o),
      hours: { purchased: h.purchased, used: h.used, left: h.left, paidMinutes: o.hourEntries.filter((e) => !e.voidedAt && e.payoutId).reduce((s, e) => s + e.minutes, 0) },
    };
  };

  // `orders` kept for anything still reading the old shape.
  const openShaped = open.map(shape);
  return NextResponse.json({ orders: openShaped, open: openShaped, resolved: resolved.map(shape) });
}
