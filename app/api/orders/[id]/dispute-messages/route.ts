import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher, disputeChannel } from "@/lib/pusher";
import { sendDisputeMessageEmail, SITE_URL } from "@/lib/email";

async function getAuthorizedOrder(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: true, seller: true, gig: true },
  });
  if (!order) return null;
  const isParticipant = order.buyerId === userId || order.sellerId === userId;
  if (!isParticipant && role !== "ADMIN") return null;
  return order;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await getAuthorizedOrder(params.id, (session.user as any).id, (session.user as any).role);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const messages = await prisma.disputeMessage.findMany({
    where: { orderId: params.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json({ messages });
}

// Anyone can post here as long as the order actually has an open dispute
// - this isn't a general-purpose chat, it exists specifically because
// /api/orders/[id]/dispute was called. Notifies whoever didn't just post:
// admin posts -> buyer and seller are emailed; buyer or seller posts ->
// every admin is emailed.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const order = await getAuthorizedOrder(params.id, userId, role);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.disputed) {
    return NextResponse.json({ error: "This order doesn't have an open dispute" }, { status: 400 });
  }

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });

  const message = await prisma.disputeMessage.create({
    data: { body, orderId: params.id, senderId: userId },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  await pusher.trigger(disputeChannel(params.id), "new-message", message);

  try {
    const senderName = message.sender.name;
    if (role === "ADMIN") {
      await Promise.all([
        sendDisputeMessageEmail(order.buyer.email, senderName, order.gig.title, body, `${SITE_URL}/orders/${order.id}`),
        sendDisputeMessageEmail(order.seller.email, senderName, order.gig.title, body, `${SITE_URL}/orders/${order.id}`),
      ]);
    } else {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
      await Promise.all(
        admins.map((admin) =>
          sendDisputeMessageEmail(admin.email, senderName, order.gig.title, body, `${SITE_URL}/orders/${order.id}`)
        )
      );
    }
  } catch (err) {
    console.error("Failed to send dispute-message email:", err);
  }

  return NextResponse.json({ message });
}
