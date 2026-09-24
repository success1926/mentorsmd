import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderPaidEmail, SITE_URL } from "@/lib/email";

// Stripe calls this URL directly (not the browser), so it's the only
// reliable place to confirm a payment actually succeeded - never trust the
// success_url redirect alone, since a user can hit that URL without paying.
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

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutSession.metadata?.orderId;

    // Only a fully paid session moves money into escrow.
    if (orderId && checkoutSession.payment_status === "paid") {
      // Look up the exact moment Stripe will consider this payment's funds
      // available - releaseOrder() checks this before attempting a Transfer.
      let fundsAvailableAt: Date | null = null;
      try {
        if (checkoutSession.payment_intent) {
          const paymentIntent = await stripe.paymentIntents.retrieve(checkoutSession.payment_intent as string, {
            expand: ["latest_charge.balance_transaction"],
          });
          const charge = paymentIntent.latest_charge as Stripe.Charge | null;
          const balanceTxn = charge?.balance_transaction as Stripe.BalanceTransaction | undefined;
          if (balanceTxn?.available_on) {
            fundsAvailableAt = new Date(balanceTxn.available_on * 1000); // Stripe uses Unix seconds
          }
        }
      } catch (err) {
        console.error("Failed to look up funds availability:", err);
      }

      // Stripe can deliver the same event more than once (retries,
      // replays). Only move PENDING_PAYMENT -> IN_ESCROW; previously a
      // late duplicate could flip an already RELEASED or REFUNDED order
      // back into escrow, making it releasable a second time.
      const result = await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "IN_ESCROW", fundsAvailableAt, stripePaymentIntentId: checkoutSession.id },
      });

      if (result.count === 1) {
        try {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { seller: { select: { email: true } }, gig: { select: { title: true } }, buyer: { select: { name: true } } },
          });
          if (order) {
            await sendOrderPaidEmail(order.seller.email, order.gig.title, order.buyer.name, `${SITE_URL}/orders/${order.id}`);
          }
        } catch (err) {
          console.error("Failed to send order-paid email:", err);
        }
      }
    }
  }

  // Abandoned checkouts: mark the placeholder order CANCELLED so they don't
  // pile up as PENDING_PAYMENT forever. (Enable this event on the webhook
  // in your Stripe dashboard.)
  if (event.type === "checkout.session.expired") {
    const orderId = (event.data.object as Stripe.Checkout.Session).metadata?.orderId;
    if (orderId) {
      await prisma.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
