import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusher, conversationChannel } from "@/lib/pusher";
import { sendNewMessageEmail, SITE_URL } from "@/lib/email";
import { LIMITS, isOurBlobUrl } from "@/lib/validate";

// Most recent N messages returned when a thread opens. Keeps long-running
// threads fast; older history can be paged in with ?before=<messageId>.
const PAGE_SIZE = 200;

// Don't email someone about every single message in a back-and-forth -
// one email per conversation per window is enough to get them back to
// the site. (Also keeps you well inside Resend's daily sending limits.)
const EMAIL_THROTTLE_MINUTES = 15;

async function assertParticipant(conversationId: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { buyer: { select: { email: true, name: true } }, seller: { select: { email: true, name: true } } },
  });
  if (!convo) return null;
  if (convo.buyerId !== userId && convo.sellerId !== userId) return null;
  return convo;
}

// Still useful for loading history when a thread first opens, even though
// new messages after that arrive instantly over Pusher.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const convo = await assertParticipant(params.id, (session.user as any).id);
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const before = new URL(req.url).searchParams.get("before");
  const beforeMsg = before ? await prisma.message.findUnique({ where: { id: before }, select: { createdAt: true } }) : null;

  // Newest PAGE_SIZE, then flipped back to oldest-first for display.
  const latest = await prisma.message.findMany({
    where: { conversationId: params.id, ...(beforeMsg ? { createdAt: { lt: beforeMsg.createdAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json({ messages: latest.reverse(), hasMore: latest.length === PAGE_SIZE });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const convo = await assertParticipant(params.id, (session.user as any).id);
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { body, attachmentUrl, attachmentName } = await req.json();
  const text = typeof body === "string" ? body : "";
  if (!text.trim() && !attachmentUrl) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }
  if (text.length > LIMITS.messageBody) {
    return NextResponse.json({ error: `Message is too long (${LIMITS.messageBody} characters max)` }, { status: 400 });
  }
  if (attachmentUrl && !isOurBlobUrl(attachmentUrl)) {
    return NextResponse.json({ error: "Invalid attachment" }, { status: 400 });
  }

  const senderId = (session.user as any).id;
  const message = await prisma.message.create({
    data: {
      body: text,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentUrl && typeof attachmentName === "string" ? attachmentName.slice(0, 200) : null,
      conversationId: params.id,
      senderId,
    },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  // Instant delivery for whoever's on the site right now. The message is
  // already saved, so a Pusher hiccup must not fail the request (the
  // client would retry and create a duplicate).
  try {
    await pusher.trigger(conversationChannel(params.id), "new-message", message);
  } catch (err) {
    console.error("Pusher trigger failed:", err);
  }

  // Email the OTHER person, throttled per conversation.
  const recipientIsSeller = convo.buyerId === senderId;
  const lastNotified = recipientIsSeller ? convo.sellerNotifiedAt : convo.buyerNotifiedAt;
  const throttleCutoff = new Date(Date.now() - EMAIL_THROTTLE_MINUTES * 60 * 1000);
  if (!lastNotified || lastNotified < throttleCutoff) {
    try {
      const recipient = recipientIsSeller ? convo.seller : convo.buyer;
      const senderName = message.sender.name;
      await sendNewMessageEmail(
        recipient.email,
        senderName,
        text || `${senderName} sent an attachment`,
        `${SITE_URL}/messages/${convo.id}`
      );
      await prisma.conversation.update({
        where: { id: convo.id },
        data: recipientIsSeller ? { sellerNotifiedAt: new Date() } : { buyerNotifiedAt: new Date() },
      });
    } catch (err) {
      console.error("Failed to send new-message email:", err);
    }
  }

  return NextResponse.json({ message });
}
