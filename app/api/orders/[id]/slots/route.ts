import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openSlotsForOrder, orderForCallsInclude } from "@/lib/callBooking";
import { callMinutes, isBlockMinutes } from "@/lib/hours";
import { bookingWindowFor, hasAvailability } from "@/lib/schedule";
import { tzOrDefault } from "@/lib/tz";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Open call times for one order, from the mentor's availability minus
// their other calls, buffers, notice, days off, busy dates and their own
// calendar's busy times. ?exclude=<callId> when moving an existing call.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: orderForCallsInclude });
  if (!order || (order.buyerId !== userId && order.sellerId !== userId)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!order.kind || order.status !== "IN_ESCROW") {
    return NextResponse.json({ slots: [], hasAvailability: false, timeZone: tzOrDefault(order.seller.timeZone) });
  }

  const url = new URL(req.url);
  const exclude = url.searchParams.get("exclude") || undefined;
  // ?minutes=30|60 (moving a call keeps its own length).
  const moving = exclude ? order.callBookings.find((b) => b.id === exclude) : undefined;
  const asked = Number(url.searchParams.get("minutes"));
  const lengthMinutes = moving ? callMinutes(moving) : isBlockMinutes(asked) ? asked : 60;
  const slots = await openSlotsForOrder(order, { excludeBookingId: exclude, lengthMinutes });
  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    lengthMinutes,
    hasAvailability: hasAvailability(order.seller.weeklyHours),
    bookingWindowDays: bookingWindowFor(order.seller.bookingWindowDays),
    timeZone: tzOrDefault(order.seller.timeZone),
  });
}
