import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendDisputeOpenedEmail, SITE_URL } from "@/lib/email";

// Disputes are buyer-raised, admin-resolved - opening one does NOT
// automatically refund or release anything. It just flags the order and
// notifies every admin account so a human decides (see /api/orders/[id]/refund
// and the release endpoint, which an admin can call on any order regardless
// of who'd normally be allowed to).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { gig: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.buyerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Only the buyer can open a dispute" }, { status: 403 });
  }
  if (!["IN_ESCROW", "COMPLETED"].includes(order.status)) {
    return NextResponse.json({ error: "You can only dispute a pending or just-completed order" }, { status: 400 });
  }

  const { reason } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "Describe the issue before opening a dispute" }, { status: 400 });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { disputed: true, disputeReason: reason },
  });

  // Seed the dispute thread with the buyer's original reason as the
  // first message, so the admin sees it in context immediately rather
  // than only in the small summary card on /admin.
  await prisma.disputeMessage.create({
    data: { body: reason, orderId: params.id, senderId: order.buyerId },
  });

  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    await Promise.all(
      admins.map((admin) =>
        sendDisputeOpenedEmail(admin.email, order.gig.title, reason, `${SITE_URL}/orders/${order.id}`)
      )
    );
  } catch (err) {
    console.error("Failed to send dispute notification email:", err);
  }

  return NextResponse.json({ order: updated });
}
