import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET() {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;

  const userId = me.id;
  const role = me.role;

  const orders = await prisma.order.findMany({
    where: role === "SELLER" ? { sellerId: userId } : { buyerId: userId },
    include: {
      gig: true,
      buyer: { select: { name: true, photoUrl: true, minorStatus: true } },
      seller: { select: { name: true, credential: true, photoUrl: true } },
      review: true,
      callBookings: { orderBy: { startTime: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
