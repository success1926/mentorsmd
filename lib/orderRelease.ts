import { Prisma } from "@prisma/client";
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

// True when Stripe clearly rejected the request, meaning nothing happened
// on their side. Anything else (network errors, 5xx) is "unknown".
export function isDefiniteStripeFailure(err: any) {
  return ["StripeInvalidRequestError", "StripeCardError", "StripePermissionError", "StripeAuthenticationError"].includes(err?.type);
}

// Thrown when the order changed underneath us (someone else released or
// refunded it first, a revision was requested, etc). This is what makes
// a double payout impossible: see the atomic "claim" step below.
export class OrderStateChangedError extends Error {
  constructor() {
    super("This order was already released, refunded, or changed - refresh the page");
    this.name = "OrderStateChangedError";
  }
}

// The one place money actually leaves the platform's Stripe balance.
// Callers decide WHETHER releasing is allowed by passing the conditions
// the order must still satisfy (`claimWhere`), e.g. { status: "COMPLETED" }.
//
// Concurrency safety: the buyer double-clicking "release", the buyer and
// the cron running at the same moment, or an admin refunding while the
// cron releases - any of these used to be able to send TWO transfers (or a
// transfer AND a refund). Now the order is "claimed" with a single
// conditional UPDATE before any money moves. Postgres guarantees only one
// caller's UPDATE can match, so only one caller ever reaches Stripe.
export async function releaseOrder(orderId: string, claimWhere: Prisma.OrderWhereInput) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { seller: true, gig: true } });
  if (!order) throw new Error("Order not found");
  if (!order.seller.stripeAccountId) throw new Error("Seller has no connected payout account");

  // fundsAvailableAt is the real timestamp Stripe calculated for this
  // charge (set by the webhook). If it's in the future, a Transfer would
  // fail with an insufficient-funds error, so stop before trying. Null
  // means the lookup failed - assume available rather than block forever.
  if (order.fundsAvailableAt && order.fundsAvailableAt > new Date()) {
    throw new FundsNotYetAvailableError(order.fundsAvailableAt);
  }

  const previousStatus = order.status;

  // Atomic claim. If count is 0, someone else got here first or the order
  // no longer meets the caller's conditions.
  const claimedAt = new Date();
  const claim = await prisma.order.updateMany({
    where: { AND: [{ id: orderId, status: previousStatus }, { status: { in: ["IN_ESCROW", "COMPLETED"] } }, claimWhere] },
    data: { status: "RELEASED", completedAt: claimedAt },
  });
  if (claim.count === 0) throw new OrderStateChangedError();

  const platformFee = Math.round((order.amount * PLATFORM_FEE_PERCENT) / 100);
  const sellerPayout = order.amount - platformFee;

  let transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: sellerPayout,
        currency: "usd",
        destination: order.seller.stripeAccountId,
        transfer_group: order.id,
        metadata: { orderId: order.id },
      },
      // One key per claim: any retry of THIS attempt can never create a
      // second transfer.
      { idempotencyKey: `release-${order.id}-${claimedAt.getTime()}` }
    );
  } catch (err: any) {
    if (isDefiniteStripeFailure(err)) {
      // Stripe definitely refused (e.g. account not ready) - no money
      // moved, so put the order back so it can be retried later.
      await prisma.order.updateMany({
        where: { id: order.id, status: "RELEASED", stripeTransferId: null },
        data: { status: previousStatus, completedAt: null },
      });
    } else {
      // Timeout / connection drop / Stripe 5xx: the transfer MAY have gone
      // through. Rolling back here is how double payouts happen, so leave
      // the order RELEASED and flag it for a human to check in the Stripe
      // dashboard (search transfers for this order id).
      console.error(
        `[NEEDS MANUAL CHECK] Release for order ${order.id} hit an ambiguous Stripe error - ` +
          `order left RELEASED; verify a transfer exists for transfer_group=${order.id}.`,
        err
      );
    }
    throw err;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeTransferId: transfer.id },
  });

  try {
    await sendOrderReleasedEmail(order.seller.email, order.gig.title, sellerPayout, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send order-released email:", err);
  }

  return { transferId: transfer.id, sellerPayout, platformFee };
}
