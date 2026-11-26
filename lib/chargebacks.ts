// Card chargebacks and refunds made in Stripe (Stripe webhook events
// charge.dispute.created, charge.dispute.closed and charge.refunded).
// Server only.
//
// A student (or a parent who paid for a gift) can ask their bank to take a
// payment back. When that happens:
//   - the package it paid for is put on hold like a dispute (Order.disputed),
//     so its hours aren't paid to the mentor and no calls or hours can be
//     added until the team decides; it shows in Admin -> Disputes;
//   - a high-severity flag is raised, which emails the team (Admin -> Flags).
// If MentorsMD wins the chargeback, the hold is lifted (only if it was the
// chargeback that put it there). If it's lost, the hold stays for the team.
// A refund made by hand in Stripe is only flagged.
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createFlag } from "@/lib/flags";
import { money } from "@/lib/format";

// Marks the dispute reason of a hold placed by a chargeback.
export const CHARGEBACK_REASON_PREFIX = "Card chargeback";

type Purchase = { orderId: string | null; what: string; studentId: string | null; mentorId: string | null };

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id ?? null);

// What a payment (PaymentIntent id) paid for: an order, "Add hours" on an
// order, or a gift. App payments store the "pi_" id; website payments
// store the Checkout Session ("cs_") id, found from the PaymentIntent.
async function purchaseFor(paymentIntentId: string): Promise<Purchase | null> {
  const fromIds = async (ids: string[]): Promise<Purchase | null> => {
    const order = await prisma.order.findFirst({ where: { stripePaymentIntentId: { in: ids } }, select: { id: true, buyerId: true, sellerId: true } });
    if (order) return { orderId: order.id, what: `order ${order.id}`, studentId: order.buyerId, mentorId: order.sellerId };
    const topUp = await prisma.hourTopUp.findFirst({
      where: { OR: [{ stripePaymentIntentId: { in: ids } }, { stripeSessionId: { in: ids } }] },
      select: { id: true, order: { select: { id: true, buyerId: true, sellerId: true } } },
    });
    if (topUp) return { orderId: topUp.order.id, what: `added hours ${topUp.id} on order ${topUp.order.id}`, studentId: topUp.order.buyerId, mentorId: topUp.order.sellerId };
    const gift = await prisma.gift.findFirst({
      where: { OR: [{ stripePaymentIntentId: { in: ids } }, { stripeSessionId: { in: ids } }] },
      select: { id: true, orderId: true, studentId: true, mentorId: true },
    });
    if (gift) return { orderId: gift.orderId, what: `gift ${gift.id}${gift.orderId ? ` (order ${gift.orderId})` : " (MentorsMD credit)"}`, studentId: gift.studentId, mentorId: gift.mentorId };
    return null;
  };
  const direct = await fromIds([paymentIntentId]);
  if (direct) return direct;
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
    const s = sessions.data[0];
    if (s) return fromIds([s.id]);
  } catch (err) {
    console.error("Couldn't look up the checkout page for a payment", paymentIntentId, err);
  }
  return null;
}

// charge.dispute.created
export async function chargebackOpened(dispute: Stripe.Dispute) {
  const pi = idOf(dispute.payment_intent as any);
  const purchase = pi ? await purchaseFor(pi) : null;
  let held = false;
  if (purchase?.orderId) {
    // Only a package still waiting to be paid out, and not already under a
    // student's dispute (that one stays as it is).
    const r = await prisma.order.updateMany({
      where: { id: purchase.orderId, status: { in: ["IN_ESCROW", "COMPLETED"] }, disputed: false },
      data: { disputed: true, disputeReason: `${CHARGEBACK_REASON_PREFIX} (${dispute.reason || "no reason given"}), Stripe dispute ${dispute.id}`, disputeResolvedAt: null, disputeResolution: null },
    });
    held = r.count > 0;
  }
  await createFlag({
    kind: "DISPUTE",
    source: "SYSTEM",
    severity: 3,
    reason: `Card chargeback: ${money(dispute.amount)}`,
    details:
      `The card holder asked their bank to take back ${money(dispute.amount)} (reason: ${dispute.reason || "none given"}). ` +
      (purchase ? `It paid for ${purchase.what}. ` : `We couldn't match it to a purchase (payment ${pi || "unknown"}). `) +
      (held ? "The package is on hold (no payout to the mentor) until you decide in Disputes. " : purchase?.orderId ? "The package was already paid out, refunded or under a dispute, so nothing was put on hold. " : "") +
      `Respond to it in Stripe (Payments -> Disputes, ${dispute.id}) before the deadline.`,
    reporterId: purchase?.studentId ?? null,
    orderId: purchase?.orderId ?? null,
    dedupeKey: `chargeback:${dispute.id}`,
    dedupeDays: 365,
  });
}

// charge.dispute.closed
export async function chargebackClosed(dispute: Stripe.Dispute) {
  const pi = idOf(dispute.payment_intent as any);
  const purchase = pi ? await purchaseFor(pi) : null;
  const won = dispute.status === "won" || dispute.status === "warning_closed";
  if (won && purchase?.orderId) {
    // Lift only the hold this chargeback placed.
    await prisma.order.updateMany({
      where: { id: purchase.orderId, disputed: true, disputeResolvedAt: null, disputeReason: { contains: `Stripe dispute ${dispute.id}` } },
      data: { disputed: false, disputeReason: null },
    });
    await prisma.flag.updateMany({
      where: { dedupeKey: `chargeback:${dispute.id}`, status: "OPEN" },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    return;
  }
  if (!won) {
    await createFlag({
      kind: "DISPUTE",
      source: "SYSTEM",
      severity: 3,
      reason: `Card chargeback lost: ${money(dispute.amount)}`,
      details:
        `The bank kept ${money(dispute.amount)} with the card holder (Stripe dispute ${dispute.id}, ${dispute.status}). ` +
        (purchase ? `It paid for ${purchase.what}. ` : "") +
        "If a package is on hold, decide in Disputes what the mentor should still be paid.",
      reporterId: purchase?.studentId ?? null,
      orderId: purchase?.orderId ?? null,
      dedupeKey: `chargeback-closed:${dispute.id}`,
      dedupeDays: 365,
    });
  }
}

// charge.refunded: refunds are only ever MentorsMD credit, so a card refund
// was made by hand in Stripe. The team checks the package's hours.
export async function cardRefunded(charge: Stripe.Charge) {
  const pi = idOf(charge.payment_intent as any);
  const purchase = pi ? await purchaseFor(pi) : null;
  await createFlag({
    kind: "DISPUTE",
    source: "SYSTEM",
    severity: 2,
    reason: `Card refunded in Stripe: ${money(charge.amount_refunded)}`,
    details:
      `${money(charge.amount_refunded)} of ${money(charge.amount)} was refunded to the card in Stripe. ` +
      (purchase ? `It paid for ${purchase.what}. ` : `We couldn't match it to a purchase (payment ${pi || "unknown"}). `) +
      "If it was a package, check its hours so the mentor isn't paid for hours that were refunded.",
    reporterId: purchase?.studentId ?? null,
    orderId: purchase?.orderId ?? null,
    dedupeKey: `card-refund:${charge.id}:${charge.amount_refunded}`,
    dedupeDays: 365,
  });
}
