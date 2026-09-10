import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher, conversationChannel } from "@/lib/pusher";
import { sendNewMessageEmail, SITE_URL } from "@/lib/email";

async function assertParticipant(conversationId: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { buyer: true, seller: true },
  });
  if (!convo) return null;
  if (convo.buyerId !== userId && convo.sellerId !== userId) return null;
  return convo;
}

// Still useful for loading history when a thread first opens, even though
// new messages after that arrive instantly over Pusher rather than by
// polling this endpoint.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const convo = await assertParticipant(params.id, (session.user as any).id);
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const convo = await assertParticipant(params.id, (session.user as any).id);
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { body, attachmentUrl, attachmentName } = await req.json();
  if (!body?.trim() && !attachmentUrl) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  const senderId = (session.user as any).id;
  const message = await prisma.message.create({
    data: { body: body || "", attachmentUrl, attachmentName, conversationId: params.id, senderId },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  // Instant delivery for whoever's on the site right now.
  await pusher.trigger(conversationChannel(params.id), "new-message", message);

  // Email the OTHER person - not the sender - so a message doesn't sit
  // unseen if they're not actively on the site. This is a best-effort
  // notification, so a failure here shouldn't fail the whole request.
  try {
    const recipient = convo.buyerId === senderId ? convo.seller : convo.buyer;
    const senderName = message.sender.name;
    await sendNewMessageEmail(
      recipient.email,
      senderName,
      body || `${senderName} sent an attachment`,
      `${SITE_URL}/coaches/${convo.sellerId}`
    );
  } catch (err) {
    console.error("Failed to send new-message email:", err);
  }

  return NextResponse.json({ message });
}
