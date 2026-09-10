import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Creates a Stripe Checkout Session for one gig package. Deliberately NOT
// a Connect "destination charge" - the money lands in OUR Stripe balance
// first (this is what makes escrow possible). We only pay the seller once
// the work is marked complete and the 48-hour window passes (or the buyer
// confirms early) - see /api/orders/[id]/mark-complete and
// /api/orders/[id]/release.
//
// Booking rule: a buyer can't pick a due date (and therefore can't check
// out) until they've messaged the coach and the coach has replied at
// least once. This keeps buyers from committing to a deadline before
// confirming the coach can actually take the work in that timeframe.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only buyer accounts can check out" }, { status: 403 });
  }

  const { gigId, dueDate } = await req.json();
  const buyerId = (session.user as any).id;

  if (!dueDate) {
    return NextResponse.json({ error: "Pick a due date before checking out" }, { status: 400 });
  }

  const gig = await prisma.gig.findUnique({ where: { id: gigId }, include: { seller: true } });
  if (!gig || !gig.active) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  if (!gig.seller.stripeAccountId) {
    return NextResponse.json({ error: "This coach hasn't finished setting up payouts yet" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { buyerId_sellerId: { buyerId, sellerId: gig.sellerId } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Message this coach before booking a due date" }, { status: 400 });
  }

  const [buyerMessageCount, sellerMessageCount] = await Promise.all([
    prisma.message.count({ where: { conversationId: conversation.id, senderId: buyerId } }),
    prisma.message.count({ where: { conversationId: conversation.id, senderId: gig.sellerId } }),
  ]);
  if (buyerMessageCount === 0 || sellerMessageCount === 0) {
    return NextResponse.json(
      { error: "Wait for the coach to reply to your message before picking a due date" },
      { status: 400 }
    );
  }

  const order = await prisma.order.create({
    data: {
      gigId: gig.id,
      buyerId,
      sellerId: gig.sellerId,
      amount: gig.price,
      status: "PENDING_PAYMENT",
      dueDate: new Date(dueDate),
      conversationId: conversation.id,
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: gig.title, description: gig.description },
          unit_amount: gig.price, // cents
        },
        quantity: 1,
      },
    ],
    metadata: { orderId: order.id },
    success_url: `${process.env.NEXTAUTH_URL}/orders/${order.id}?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/gigs/${gig.id}?cancelled=true`,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: checkoutSession.id },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
