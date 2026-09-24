import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A single order, for the order detail page. Previously that page fetched
// EVERY order the user had and searched for one client-side, which also
// meant admins (who aren't the buyer or seller) couldn't open a disputed
// order at all.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      gig: true,
      buyer: { select: { name: true } },
      seller: { select: { name: true, credential: true } },
      review: true,
    },
  });

  if (!order || (order.buyerId !== userId && order.sellerId !== userId && role !== "ADMIN")) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
