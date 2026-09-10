import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher";

// The Pusher JS client calls this automatically whenever it tries to
// subscribe to a "private-*" channel. If this route doesn't approve the
// request, the subscription is rejected client-side - this is what stops
// a buyer from listening in on someone else's conversation or dispute.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string;
  const channelName = formData.get("channel_name") as string;

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  let authorized = false;

  if (channelName.startsWith("private-conversation-")) {
    const conversationId = channelName.replace("private-conversation-", "");
    const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
    authorized = !!convo && (convo.buyerId === userId || convo.sellerId === userId);
  } else if (channelName.startsWith("private-dispute-")) {
    const orderId = channelName.replace("private-dispute-", "");
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    // Admins can join any dispute thread; buyer/seller only their own.
    authorized = !!order && (role === "ADMIN" || order.buyerId === userId || order.sellerId === userId);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Not authorized for this channel" }, { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
