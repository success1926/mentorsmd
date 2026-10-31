import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderPaidEmail, SITE_URL } from "@/lib/email";
import { sendParentReceipt } from "@/lib/minors";
import { applyTopUp, cancelUnpaid, fulfilAppPayment, fulfilOrderPayment, fundsAvailableFor } from "@/lib/hourCheckout";
import { cancelUnpaidGift, fulfilGift } from "@/lib/gifts";

// Stripe calls this URL directly (not the browser), so it's the only
// reliable place to confirm a payment actually succeeded - never trust the
// success_url redirect alone, since a user can hit that URL without paying.
//
// Four kinds of checkout (metadata on the session):
//   giftId            a parent's gift: credit or a package (lib/gifts.ts)
//   topUpId           "Add hours" on a package (lib/hourCheckout.ts)
//   orderId + kind    a new hours order or pay-per-call (lib/hourCheckout.ts)
//   orderId           an order from before the redesign (handled below)
// The phone app pays with Stripe's payment sheet instead of a Checkout
// page: a PaymentIntent whose metadata has channel "app" plus orderId /
// topUpId (payment_intent.succeeded and payment_intent.canceled below).
// Every one is fulfilled once, however many times Stripe sends the event.
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const { orderId, topUpId, giftId } = checkoutSession.metadata || {};

    // Only a fully paid session counts.
    if (checkoutSession.payment_status === "paid") {
      if (giftId) {
        await fulfilGift(giftId, checkoutSession);
      } else if (topUpId) {
        await applyTopUp(topUpId, checkoutSession);
      } else if (orderId) {
        const order = await prisma.order.findUnique({ where: { id: orderId }, select: { kind: true } });
        if (order?.kind) await fulfilOrderPayment(orderId, checkoutSession);
        else if (order) await fulfilOldOrder(orderId, checkoutSession);
      }
    }
  }

  // Abandoned checkouts: cancel the placeholder order / top-up (and give
  // back any MentorsMD credit applied) so they don't pile up unpaid.
  // (Enable this event on the webhook in your Stripe dashboard.)
  if (event.type === "checkout.session.expired") {
    const { orderId, topUpId, giftId } = (event.data.object as Stripe.Checkout.Session).metadata || {};
    if (giftId) {
      await cancelUnpaidGift(giftId);
    } else if (topUpId) {
      await cancelUnpaid({ topUpId });
    } else if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { kind: true } });
      if (order?.kind) await cancelUnpaid({ orderId });
      else
        await prisma.order.updateMany({
          where: { id: orderId, status: "PENDING_PAYMENT" },
          data: { status: "CANCELLED" },
        });
    }
  }

  // The phone app's payment sheet (lib/hourCheckout.ts). Payments made
  // on a Checkout page also have a PaymentIntent; those are handled above
  // from the session, so only channel "app" counts here.
  // (Enable payment_intent.succeeded and payment_intent.canceled on the
  // webhook in your Stripe dashboard.)
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.channel === "app") await fulfilAppPayment(intent);
  }
  if (event.type === "payment_intent.canceled") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.channel === "app") {
      const { orderId, topUpId } = intent.metadata;
      if (topUpId) await cancelUnpaid({ topUpId });
      else if (orderId) await cancelUnpaid({ orderId });
    }
  }

  return NextResponse.json({ received: true });
}

// Orders from before the redesign (a package with a due date).
async function fulfilOldOrder(orderId: string, checkoutSession: Stripe.Checkout.Session) {
  // The exact moment Stripe will consider this payment's funds available -
  // releaseOrder() checks this before attempting a Transfer.
  const fundsAvailableAt = await fundsAvailableFor(checkoutSession);

  // Stripe can deliver the same event more than once (retries, replays).
  // Only move PENDING_PAYMENT -> IN_ESCROW; previously a late duplicate
  // could flip an already RELEASED or REFUNDED order back into escrow,
  // making it releasable a second time.
  const result = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status: "IN_ESCROW", fundsAvailableAt, stripePaymentIntentId: checkoutSession.id, paidAt: new Date() },
  });
  if (result.count !== 1) return;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { seller: { select: { email: true } }, gig: { select: { title: true } }, buyer: { select: { name: true } } },
    });
    if (order) await sendOrderPaidEmail(order.seller.email, order.gig.title, order.buyer.name, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send order-paid email:", err);
  }
  // Students under 18: their parent or guardian gets a receipt (#109).
  await sendParentReceipt(orderId).catch((err) => console.error("Failed to send the parent receipt:", err));
}
