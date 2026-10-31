import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

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
