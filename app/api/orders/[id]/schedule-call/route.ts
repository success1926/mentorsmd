import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Deliberately simple: either the buyer or seller can set/change the time
// directly - there's no separate "propose then accept" negotiation flow.
// In practice they agree on a time via messaging first, then whoever
// wants to lock it in calls this. If you later want a firmer
// propose/confirm handshake, this is the endpoint to extend.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = (session.user as any).id;
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return NextResponse.json({ error: "Not a participant on this order" }, { status: 403 });
  }

  const { scheduledCallTime } = await req.json();
  if (!scheduledCallTime) return NextResponse.json({ error: "A date and time is required" }, { status: 400 });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { scheduledCallTime: new Date(scheduledCallTime) },
  });

  return NextResponse.json({ order: updated });
}
