// Receipts (student area v2, Oct 2026): every payment a student made on
// MentorsMD, built from what's already in the database. Server only.
//
// Two kinds of payment:
//   - an order: an hours package, hour bundle, hourly, pay-per-call, or an
//     order from before the hourly redesign (Order.amount is the full
//     price; creditAppliedCents of it was paid with MentorsMD credit, the
//     rest by card through Stripe). Order.stripePaymentIntentId holds the
//     Stripe Checkout Session id ("cs_...") for website purchases, or the
//     PaymentIntent id ("pi_...") for phone app purchases.
//   - "Add hours" on a package (HourTopUp, status PAID).
// Refunds: orders from before the redesign could be refunded to the card
// (status REFUNDED); hours packages are only ever refunded as MentorsMD
// credit (CreditEntry DISPUTE_REFUND on the order).
//
// Stripe's own receipt (receipt_url on the charge) isn't stored: it's
// looked up when the student asks for it (stripeReceiptUrl).
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { KIND_LABEL, hoursLabel } from "@/lib/pricing";
import { money } from "@/lib/options";

export type Receipt = {
  id: string; // "o_<orderId>" or "t_<topUpId>"
  type: "ORDER" | "TOP_UP";
  date: Date;
  orderId: string;
  mentorName: string;
  title: string; // what was bought
  detail: string; // e.g. "5 hours at $80/hr"
  totalCents: number;
  creditAppliedCents: number;
  chargedCents: number; // paid by card
  refundedToCardCents: number;
  refundedAsCreditCents: number;
  status: string;
  // A Stripe payment exists to look the receipt up from.
  stripeRef: string | null;
};


const orderSelect = {
  id: true,
  kind: true,
  status: true,
  amount: true,
  creditAppliedCents: true,
  minutesPurchased: true,
  rateCents: true,
  packageTitle: true,
  stripePaymentIntentId: true,
  createdAt: true,
  paidAt: true,
  refundedAt: true,
  buyerId: true,
  gig: { select: { title: true } },
  seller: { select: { name: true } },
  topUps: { where: { status: "PAID" }, select: { id: true, minutes: true, rateCents: true, amountCents: true, creditAppliedCents: true, stripeSessionId: true, stripePaymentIntentId: true, paidAt: true, createdAt: true, buyerId: true } },
  creditEntries: { where: { reason: "DISPUTE_REFUND" }, select: { amountCents: true } },
} as const;

// Packages a parent bought as a gift (lib/gifts.ts): the student didn't
// pay, so their receipt says who did and has no Stripe receipt (that went
// to the parent).
async function giftsFor(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, string>();
  const gifts = await prisma.gift.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true, parentName: true } });
  return new Map(gifts.map((g) => [g.orderId!, g.parentName]));
}
function markGifts(receipts: Receipt[], gifts: Map<string, string>) {
  for (const r of receipts) {
    const parent = r.type === "ORDER" ? gifts.get(r.orderId) : undefined;
    if (!parent) continue;
    r.detail = `Gift from ${parent} · ${r.detail}`;
    r.chargedCents = 0;
    r.stripeRef = null;
  }
  return receipts;
}

type OrderRow = Awaited<ReturnType<typeof loadOrders>>[number];

function loadOrders(where: { buyerId: string; id?: string }) {
  return prisma.order.findMany({
    where: { ...where, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
    select: orderSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

function statusLabel(r: Pick<Receipt, "totalCents" | "refundedToCardCents" | "refundedAsCreditCents">) {
  if (r.refundedToCardCents > 0) return "Refunded to card";
  if (r.refundedAsCreditCents >= r.totalCents && r.totalCents > 0) return "Refunded as credit";
  if (r.refundedAsCreditCents > 0) return "Partly refunded as credit";
  return "Paid";
}

function fromOrder(o: OrderRow): Receipt[] {
  const title = o.packageTitle || o.gig.title;
  const mentorName = o.seller.name;
  const topUpMinutes = o.topUps.reduce((s, t) => s + t.minutes, 0);
  const minutes = Math.max(0, o.minutesPurchased - topUpMinutes);
  const kind = o.kind ? KIND_LABEL[o.kind] || "Package" : "";
  const detail = o.kind
    ? o.kind === "PAY_PER_CALL"
      ? `${kind}: one ${hoursLabel(minutes)} call${o.rateCents ? ` at ${money(o.rateCents)}/hr` : ""}`
      : `${kind}: ${hoursLabel(minutes)}${o.rateCents ? ` at ${money(o.rateCents)}/hr` : ""}`
    : "Package";
  const chargedCents = Math.max(0, o.amount - o.creditAppliedCents);
  const refundedToCardCents = !o.kind && o.status === "REFUNDED" ? chargedCents : 0;
  // A dispute refund can cover the package and its added hours: it's shown
  // on the package receipt first, then on each top-up, never more than
  // what that receipt was for.
  let refundLeft = o.creditEntries.reduce((s, c) => s + Math.max(0, c.amountCents), 0);
  const takeRefund = (cap: number) => {
    const part = Math.min(refundLeft, Math.max(0, cap));
    refundLeft -= part;
    return part;
  };
  const refundedAsCreditCents = takeRefund(o.amount);
  const base: Receipt = {
    id: `o_${o.id}`,
    type: "ORDER",
    date: o.paidAt || o.createdAt,
    orderId: o.id,
    mentorName,
    title,
    detail,
    totalCents: o.amount,
    creditAppliedCents: o.creditAppliedCents,
    chargedCents,
    refundedToCardCents,
    refundedAsCreditCents,
    status: "",
    stripeRef: chargedCents > 0 ? o.stripePaymentIntentId : null,
  };
  base.status = statusLabel(base);
  const topUps: Receipt[] = o.topUps.map((t) => {
    const charged = Math.max(0, t.amountCents - t.creditAppliedCents);
    const refunded = takeRefund(t.amountCents);
    const receipt: Receipt = {
      id: `t_${t.id}`,
      type: "TOP_UP",
      date: t.paidAt || t.createdAt,
      orderId: o.id,
      mentorName,
      title: `Added hours: ${title}`,
      detail: `${hoursLabel(t.minutes)} at ${money(t.rateCents)}/hr`,
      totalCents: t.amountCents,
      creditAppliedCents: t.creditAppliedCents,
      chargedCents: charged,
      refundedToCardCents: 0,
      refundedAsCreditCents: refunded,
      status: "",
      stripeRef: charged > 0 ? t.stripePaymentIntentId || t.stripeSessionId : null,
    };
    receipt.status = statusLabel(receipt);
    return receipt;
  });
  return [base, ...topUps];
}

// Every receipt of a student, newest first.
export async function receiptsFor(studentId: string): Promise<Receipt[]> {
  const orders = await loadOrders({ buyerId: studentId });
  const gifts = await giftsFor(orders.map((o) => o.id));
  return markGifts(orders.flatMap(fromOrder), gifts).sort((a, b) => b.date.getTime() - a.date.getTime());
}

// One receipt, only if it belongs to this student (null otherwise, so the
// page shows "not found" whether it doesn't exist or isn't theirs).
export async function receiptFor(studentId: string, receiptId: string): Promise<Receipt | null> {
  const m = /^(o|t)_([a-z0-9]{10,40})$/i.exec(receiptId || "");
  if (!m) return null;
  let orderId = m[2];
  if (m[1] === "t") {
    const t = await prisma.hourTopUp.findUnique({ where: { id: m[2] }, select: { orderId: true, buyerId: true, status: true } });
    if (!t || t.buyerId !== studentId || t.status !== "PAID") return null;
    orderId = t.orderId;
  }
  const [order] = await loadOrders({ buyerId: studentId, id: orderId });
  if (!order) return null;
  return markGifts(fromOrder(order), await giftsFor([order.id])).find((r) => r.id === receiptId) || null;
}

// Stripe's hosted receipt for a payment (a Checkout Session id "cs_..." or
// a PaymentIntent id "pi_..."), or null if Stripe has none.
export async function stripeReceiptUrl(ref: string | null): Promise<string | null> {
  if (!ref || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    let pi: string | null = null;
    if (ref.startsWith("cs_")) {
      const s = await stripe.checkout.sessions.retrieve(ref);
      pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null;
    } else if (ref.startsWith("pi_")) {
      pi = ref;
    }
    if (!pi) return null;
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | string | null;
    return charge && typeof charge !== "string" ? charge.receipt_url || null : null;
  } catch (err) {
    console.error("Couldn't look up the Stripe receipt", err);
    return null;
  }
}
