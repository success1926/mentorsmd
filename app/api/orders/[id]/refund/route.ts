import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { isDefiniteStripeFailure } from "@/lib/orderRelease";

// Admin-only, on purpose - this is the resolution path for a dispute, and
// giving buyers or sellers the ability to trigger it themselves would
// defeat the point of holding funds in escrow in the first place.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (!["IN_ESCROW", "COMPLETED"].includes(order.status)) {
    return NextResponse.json({ error: `Only a pending or just-completed order can be refunded (currently ${order.status})` }, { status: 400 });
  }
  if (!order.stripePaymentIntentId) {
    return NextResponse.json({ error: "No payment record found for this order" }, { status: 400 });
  }

  // stripePaymentIntentId currently stores the Checkout Session id (see
  // /api/checkout) - look up the actual PaymentIntent from it before refunding.
  const checkoutSession = await stripe.checkout.sessions.retrieve(order.stripePaymentIntentId);
  if (!checkoutSession.payment_intent) {
    return NextResponse.json({ error: "Payment hasn't completed yet - nothing to refund" }, { status: 400 });
  }

  // Atomic claim - same idea as releaseOrder(). Stops a double-click, or a
  // refund racing the auto-release cron, from moving money twice.
  const claimedAt = Date.now();
  const claim = await prisma.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: "REFUNDED" },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "This order was already released or refunded - refresh the page" }, { status: 409 });
  }

  try {
    await stripe.refunds.create(
      { payment_intent: checkoutSession.payment_intent as string, metadata: { orderId: order.id } },
      { idempotencyKey: `refund-${order.id}-${claimedAt}` }
    );
  } catch (err: any) {
    console.error(`Refund failed for order ${order.id}:`, err);
    if (isDefiniteStripeFailure(err)) {
      // Stripe refused - no money moved, so the order goes back to escrow.
      await prisma.order.updateMany({ where: { id: order.id, status: "REFUNDED" }, data: { status: order.status } });
      return NextResponse.json({ error: err.message || "Refund failed" }, { status: 502 });
    }
    // Network/5xx: the refund MAY have happened. Keep the order REFUNDED
    // (so it can't also be released) and have a human confirm in Stripe.
    return NextResponse.json(
      { error: "Couldn't confirm the refund with Stripe. The order is marked refunded - check the payment in your Stripe dashboard." },
      { status: 502 }
    );
  }

  const updated = await prisma.order.findUnique({ where: { id: order.id } });
  return NextResponse.json({ order: updated });
}
