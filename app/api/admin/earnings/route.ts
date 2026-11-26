import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { hoursSummary } from "@/lib/hours";
import { finishPhase } from "@/lib/finishing";
import { openDispute, unpaidValueCents } from "@/lib/payoutRules";

export const dynamic = "force-dynamic";

// Admin -> Orders & payouts: the money summary and every paid order.
// Worked out from the database (orders, paid top-ups, the credit ledger
// and the monthly payouts), so it always matches what happened:
//   - Sales: package prices plus paid "Add hours" top-ups.
//   - Paid with credit: the part of those paid with MentorsMD credit.
//   - Collected by card: sales minus credit (what Stripe charged).
//   - Paid to mentors / MentorsMD fee: monthly payouts sent.
//   - Not yet paid out: the value of hours bought that haven't been paid
//     to a mentor yet (active, waiting, approved and disputed packages).
//   - Credit issued: refunds given as credit and manual additions.
//   - Gift credit sold: MentorsMD credit parents paid for on /gift
//     (lib/gifts.ts). Packages parents bought are normal orders, tagged
//     with the parent's name (giftFrom).
export async function GET() {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const [orders, payouts, creditIssued, creditBalance, giftCredit] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] } },
      // Only the fields shown - never pull whole User rows (password hashes etc).
      select: {
        id: true, status: true, kind: true, amount: true, creditAppliedCents: true, rateCents: true, minutesPurchased: true, packageTitle: true,
        disputed: true, disputeResolvedAt: true, markedCompleteAt: true, responseDeadline: true, approvedAt: true, lastCallUsedAt: true, lastRevisionUsedAt: true,
        unusedMinutesPaid: true, createdAt: true, paidAt: true,
        gig: { select: { title: true } }, seller: { select: { name: true } }, buyer: { select: { name: true } },
        topUps: { where: { status: "PAID" }, select: { amountCents: true, creditAppliedCents: true, minutes: true } },
        hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true, payoutId: true } },
        callBookings: { select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true } },
        creditEntries: { where: { reason: "DISPUTE_REFUND" }, select: { amountCents: true } },
        payout: { select: { period: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.mentorPayout.findMany({ where: { status: "PAID" }, select: { amountCents: true, grossCents: true } }),
    prisma.creditEntry.aggregate({ where: { reason: { in: ["DISPUTE_REFUND", "ADMIN_ADJUST"] }, amountCents: { gt: 0 } }, _sum: { amountCents: true } }),
    prisma.creditEntry.aggregate({ _sum: { amountCents: true } }),
    prisma.creditEntry.aggregate({ where: { reason: "GIFT" }, _sum: { amountCents: true } }),
  ]);
  const gifts = await prisma.gift.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { orderId: true, parentName: true } });
  const giftFrom = new Map(gifts.map((g) => [g.orderId!, g.parentName]));

  let sales = 0;
  let credit = 0;
  let notPaidOut = 0;
  const rows = orders.map((o) => {
    const topUpCents = o.topUps.reduce((s, t) => s + t.amountCents, 0);
    const topUpCredit = o.topUps.reduce((s, t) => s + t.creditAppliedCents, 0);
    const priceCents = o.amount + topUpCents;
    const creditCents = o.creditAppliedCents + topUpCredit;
    sales += priceCents;
    credit += creditCents;
    const refundedCreditCents = o.creditEntries.reduce((s, c) => s + c.amountCents, 0);
    const h = hoursSummary(o);
    notPaidOut += unpaidValueCents({ ...o, refundedCreditCents });
    return {
      id: o.id,
      kind: o.kind,
      status: o.status,
      phase: finishPhase(o),
      disputeOpen: openDispute(o),
      title: o.packageTitle || o.gig.title,
      buyerName: o.buyer.name,
      sellerName: o.seller.name,
      priceCents,
      creditCents,
      topUpCents,
      refundedCreditCents,
      minutesPurchased: h.purchased,
      minutesUsed: h.used,
      minutesLeft: h.left,
      payout: o.payout,
      createdAt: o.paidAt ?? o.createdAt,
      giftFrom: giftFrom.get(o.id) ?? null,
    };
  });

  const paidToMentors = payouts.reduce((s, p) => s + p.amountCents, 0);
  const platformFee = payouts.reduce((s, p) => s + (p.grossCents - p.amountCents), 0);
  return NextResponse.json({
    salesCents: sales,
    creditUsedCents: credit,
    collectedCents: sales - credit,
    platformCutCents: platformFee,
    paidToSellersCents: paidToMentors,
    notPaidOutCents: notPaidOut,
    creditIssuedCents: creditIssued._sum.amountCents || 0,
    creditOutstandingCents: Math.max(0, creditBalance._sum.amountCents || 0),
    giftCreditSoldCents: giftCredit._sum.amountCents || 0,
    orders: rows,
  });
}
