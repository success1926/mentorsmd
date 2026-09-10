import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReviewReceivedEmail, SITE_URL } from "@/lib/email";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { seller: true, gig: true, review: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = (session.user as any).id;
  if (order.buyerId !== userId) {
    return NextResponse.json({ error: "Only the buyer can review this order" }, { status: 403 });
  }
  if (order.status !== "RELEASED") {
    return NextResponse.json({ error: "You can only review an order after payment is released" }, { status: 400 });
  }
  if (order.review) {
    return NextResponse.json({ error: "This order already has a review" }, { status: 409 });
  }

  const { rating, comment } = await req.json();
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      rating: ratingNum,
      comment: comment || null,
      orderId: order.id,
      buyerId: userId,
      sellerId: order.sellerId,
    },
  });

  try {
    await sendReviewReceivedEmail(order.seller.email, ratingNum, order.gig.title, `${SITE_URL}/coaches/${order.sellerId}`);
  } catch (err) {
    console.error("Failed to send review notification email:", err);
  }

  return NextResponse.json({ review });
}
