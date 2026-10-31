import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Student-only: "I don't need the call." Lets the mentor finish the order
// without it. Can't be undone from the site (an admin can reset it).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { gig: true } });
  if (!order || order.buyerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.kind) return NextResponse.json({ error: "This package has no included call to skip" }, { status: 400 });
  if (order.status !== "IN_ESCROW") return NextResponse.json({ error: "This order isn't active" }, { status: 400 });
  if (order.gig.callsIncluded === 0) return NextResponse.json({ error: "This package doesn't include a call" }, { status: 400 });

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { callWaivedAt: new Date(), callHoldAt: null },
  });
  return NextResponse.json({ order: updated });
}
