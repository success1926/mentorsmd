import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openSlotsForOrder, orderForCallsInclude } from "@/lib/callBooking";
import { callMinutes, isBlockMinutes } from "@/lib/hours";
import { hasAvailability } from "@/lib/schedule";
import { tzOrDefault } from "@/lib/tz";

export const dynamic = "force-dynamic";

// Open call times for one order, from the mentor's availability minus
// their other calls, buffers, notice, days off, busy dates and their own
// calendar's busy times. ?exclude=<callId> when moving an existing call.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: orderForCallsInclude });
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!["IN_ESCROW", "COMPLETED"].includes(order.status) || (!order.kind && order.gig.callsIncluded === 0)) {
    return NextResponse.json({ slots: [], hasAvailability: false, timeZone: tzOrDefault(order.seller.timeZone) });
  }

  const url = new URL(req.url);
  const exclude = url.searchParams.get("exclude") || undefined;
  // Hours orders: ?minutes=30|60 (moving a call keeps its own length).
  const moving = exclude ? order.callBookings.find((b) => b.id === exclude) : undefined;
  const asked = Number(url.searchParams.get("minutes"));
  const lengthMinutes = order.kind ? (moving ? callMinutes(moving) : isBlockMinutes(asked) ? asked : 60) : order.gig.callLength || 30;
  const slots = await openSlotsForOrder(order, { excludeBookingId: exclude, lengthMinutes });
  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    lengthMinutes,
    hasAvailability: hasAvailability(order.seller.weeklyHours),
    timeZone: tzOrDefault(order.seller.timeZone),
  });
}
