import { NextResponse } from "next/server";
import { adminCan, adminIdsWith } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { sendLive } from "@/lib/realtime";
import { sendDisputeMessageEmail, SITE_URL } from "@/lib/email";
import { LIMITS } from "@/lib/validate";
import { getSession } from "@/lib/session";

async function getAuthorizedOrder(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { buyer: { select: { email: true } }, seller: { select: { email: true } }, gig: { select: { title: true } } },
  });
  if (!order) return null;
  const isParticipant = order.buyerId === userId || order.sellerId === userId;
  // Admins need the Disputes permission (lib/adminPermissions.ts).
  if (!isParticipant && !(role === "ADMIN" && (await adminCan("disputes")))) return null;
  return order;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
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
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const order = await getAuthorizedOrder(params.id, userId, role);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.disputed) {
    return NextResponse.json({ error: "This order doesn't have an open dispute" }, { status: 400 });
  }

  const { body } = await req.json().catch(() => ({}));
  if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  if (body.length > LIMITS.messageBody) {
    return NextResponse.json({ error: `Message is too long (${LIMITS.messageBody} characters max)` }, { status: 400 });
  }

  const message = await prisma.disputeMessage.create({
    data: { body, orderId: params.id, senderId: userId },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  // Live update for the student, the mentor and every admin who handles
  // disputes. Never throws.
  await sendLive([order.buyerId, order.sellerId, ...(await adminIdsWith("disputes").catch(() => []))], "dispute-message", {
    orderId: params.id,
    message,
  });

  try {
    const senderName = message.sender.name;
    if (role === "ADMIN") {
      await Promise.all([
        sendDisputeMessageEmail(order.buyer.email, senderName, order.gig.title, body, `${SITE_URL}/orders/${order.id}`),
        sendDisputeMessageEmail(order.seller.email, senderName, order.gig.title, body, `${SITE_URL}/orders/${order.id}`),
      ]);
    } else {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", removedByAdmin: false, adminDisabledAt: null }, select: { email: true } });
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
