import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// One call, for the pre-join screen. Only the student and mentor on the
// order (and admins) can see it.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = session.user as any;

  const booking = await prisma.callBooking.findUnique({
    where: { id: params.id },
    include: {
      order: {
        select: {
          id: true, status: true, buyerId: true, sellerId: true,
          gig: { select: { title: true, callLength: true } },
          buyer: { select: { name: true } },
          seller: { select: { name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!booking || (booking.order.buyerId !== user.id && booking.order.sellerId !== user.id && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  const isMentor = booking.order.sellerId === user.id;
  return NextResponse.json({
    call: {
      id: booking.id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      orderId: booking.order.id,
      orderStatus: booking.order.status,
      title: booking.order.gig.title,
      otherName: isMentor ? booking.order.buyer.name : booking.order.seller.name,
      canJoin: booking.order.buyerId === user.id || isMentor,
    },
  });
}
