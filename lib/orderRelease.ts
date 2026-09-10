import { prisma } from "@/lib/prisma";
import { stripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { sendOrderReleasedEmail, SITE_URL } from "@/lib/email";

// Thrown specifically when Stripe hasn't marked this payment's funds as
// available yet - callers check for this exact error type so they can
// show a friendly "still settling" message instead of a raw failure, and
// so the auto-release cron knows to just quietly retry tomorrow rather
// than logging it as a real problem.
export class FundsNotYetAvailableError extends Error {
  constructor(public availableAt: Date) {
    super(`Funds aren't available until ${availableAt.toISOString()}`);
    this.name = "FundsNotYetAvailableError";
  }
}

// The one place money actually leaves the platform's Stripe balance.
// Deliberately has NO auth logic in it - callers (the authenticated
// route, or the cron job) are responsible for deciding WHETHER releasing
// is allowed. This function just does it - and now also checks WHEN
// it's actually possible to do it.
export async function releaseOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: true, gig: true } });
  if (!order) throw new Error("Order not found");
  if (!order.seller.stripeAccountId) throw new Error("Seller has no connected payout account");

  // The actual fix for the "card payments take a day or two to settle"
  // problem: fundsAvailableAt is the real timestamp Stripe calculated
  // for this specific charge (set by the webhook when payment cleared).
  // If it's in the future, a Transfer would fail with an insufficient-
  // funds error from Stripe - so this stops before ever attempting one.
  // (If fundsAvailableAt is null - e.g. the webhook's lookup failed for
  // some reason - this doesn't block; it assumes available rather than
  // blocking forever on a missing value.)
  if (order.fundsAvailableAt && order.fundsAvailableAt > new Date()) {
    throw new FundsNotYetAvailableError(order.fundsAvailableAt);
  }

  const platformFee = Math.round((order.amount * PLATFORM_FEE_PERCENT) / 100);
  const sellerPayout = order.amount - platformFee;

  const transfer = await stripe.transfers.create({
    amount: sellerPayout,
    currency: "usd",
    destination: order.seller.stripeAccountId,
    transfer_group: order.id,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "RELEASED", completedAt: new Date() },
  });

  try {
    await sendOrderReleasedEmail(order.seller.email, order.gig.title, sellerPayout, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send order-released email:", err);
  }

  return { transferId: transfer.id, sellerPayout, platformFee };
}
