import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockBetween } from "@/lib/blocks";
import { isEmailConfirmed } from "@/lib/emailVerification";

// One conversation plus the orders between these two people, for the
// side panel on the message thread (order status, and "Book a call" when
// a paid package includes one).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, name: true, photoUrl: true, minorStatus: true } },
      seller: {
        select: { id: true, name: true, credential: true, photoUrl: true, profileStatus: true, pausedUntil: true, awayNote: true },
      },
    },
  });
  if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const orders = await prisma.order.findMany({
    where: { buyerId: conversation.buyerId, sellerId: conversation.sellerId, status: { not: "PENDING_PAYMENT" } },
    include: { gig: true, callBookings: { orderBy: { startTime: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const otherId = conversation.buyerId === userId ? conversation.sellerId : conversation.buyerId;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, emailVerified: true, safetyHoldAt: true } });
  const [blocks, emailConfirmed] = await Promise.all([blockBetween(userId, otherId), me ? isEmailConfirmed(me) : Promise.resolve(true)]);

  return NextResponse.json({
    conversation,
    safety: { ...blocks, emailConfirmed, onHold: !!me?.safetyHoldAt && me.role === "BUYER" },
    orders,
    viewer: { id: userId, name: session.user.name ?? "", email: session.user.email ?? "" },
  });
}
