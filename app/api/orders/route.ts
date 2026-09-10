import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const orders = await prisma.order.findMany({
    where: role === "SELLER" ? { sellerId: userId } : { buyerId: userId },
    include: {
      gig: true,
      buyer: { select: { name: true } },
      seller: { select: { name: true, credential: true } },
      review: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
