import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWorkCompleteEmail, SITE_URL } from "@/lib/email";

// This is now the ONLY way an order moves out of IN_ESCROW under normal
// circumstances - the seller says the work is done, which starts the
// 96-hour clock. From here: the buyer can confirm early (immediate
// release, see /api/orders/[id]/release) or do nothing, in which case
// /api/cron/auto-release picks it up once 96 hours have passed.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { buyer: true, gig: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.sellerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Only the coach on this order can mark it complete" }, { status: 403 });
  }
  if (order.status !== "IN_ESCROW") {
    return NextResponse.json({ error: `Order isn't awaiting completion (currently ${order.status})` }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: "COMPLETED", workCompletedAt: new Date() },
  });

  try {
    await sendWorkCompleteEmail(order.buyer.email, order.gig.title, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send work-complete email:", err);
  }

  return NextResponse.json({ order: updated });
}
