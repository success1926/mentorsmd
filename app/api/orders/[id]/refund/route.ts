import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

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

  await stripe.refunds.create({
    payment_intent: checkoutSession.payment_intent as string,
  });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: "REFUNDED" },
  });

  return NextResponse.json({ order: updated });
}
