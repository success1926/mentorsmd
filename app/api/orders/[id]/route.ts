import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAvailability } from "@/lib/schedule";

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
      buyer: { select: { name: true, photoUrl: true, minorStatus: true } },
      seller: { select: { name: true, credential: true, photoUrl: true, weeklyHours: true } },
      review: true,
      callBookings: {
        orderBy: { startTime: "asc" },
        include: {
          attendance: { orderBy: { joinedAt: "asc" }, select: { id: true, userId: true, name: true, joinedAt: true, leftAt: true, durationSec: true } },
          // Recordings are admin-only; removed below for everyone else.
          recordings: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, startedAt: true, durationSec: true, deletedAt: true } },
        },
      },
      deliveries: { orderBy: { number: "asc" } },
    },
  });

  if (!order || (order.buyerId !== userId && order.sellerId !== userId && role !== "ADMIN")) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const isAdmin = role === "ADMIN";
  const { weeklyHours, ...seller } = order.seller;
  const safe = {
    ...order,
    seller: { ...seller, hasAvailability: hasAvailability(weeklyHours) },
    callBookings: order.callBookings.map(({ recordings, ...b }) => ({ ...b, ...(isAdmin ? { recordings } : {}) })),
  };
  return NextResponse.json({
    order: safe,
    viewer: { id: userId, role, name: session.user.name ?? "", email: session.user.email ?? "" },
  });
}
