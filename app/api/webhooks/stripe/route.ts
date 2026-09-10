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
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const orderId = checkoutSession.metadata?.orderId;

    if (orderId) {
      // Look up the EXACT moment Stripe will consider this specific
      // payment's funds available - not a generic "2 business days"
      // guess, but the real timestamp Stripe itself calculates for this
      // charge (card type, currency, and your account's payout schedule
      // all affect it). This is what releaseOrder() checks before ever
      // attempting a Transfer, so a release can never be attempted
      // before Stripe actually has the money to move.
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
        // If this lookup fails for any reason, fundsAvailableAt just
        // stays null - releaseOrder() treats that as "unknown, assume
        // available" rather than blocking forever on a lookup error.
        console.error("Failed to look up funds availability:", err);
      }

      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: "IN_ESCROW", fundsAvailableAt },
        include: { seller: true, gig: true, buyer: true },
      });

      try {
        await sendOrderPaidEmail(order.seller.email, order.gig.title, order.buyer.name, `${SITE_URL}/orders/${order.id}`);
      } catch (err) {
        console.error("Failed to send order-paid email:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
