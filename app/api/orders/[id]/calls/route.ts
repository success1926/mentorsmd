import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDate } from "@/lib/validate";
import { canChangeOnline, CANCEL_CUTOFF_HOURS } from "@/lib/calls";
import { CallError, bookCall, cancelCall, orderForCallsInclude, rescheduleCall } from "@/lib/callBooking";

// Calls on one order (built-in calendar):
//   POST   { startTime }            book a call (student: an open slot; mentor: any agreed time)
//   PATCH  { bookingId, startTime } move a call (either side, until 24h before)
//   DELETE { bookingId }            cancel a call (either side until 24h before; admins any time)
// Calls can only be booked on a paid order whose package includes one.
async function load(params: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const user = session.user as any;
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: orderForCallsInclude });
  const isAdmin = user.role === "ADMIN";
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id && !isAdmin)) {
    return { error: NextResponse.json({ error: "Order not found" }, { status: 404 }) };
  }
  return { order, user, isAdmin, isMentor: order.sellerId === user.id, isStudent: order.buyerId === user.id };
}

function fail(err: any) {
  if (err instanceof CallError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("Call change failed", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params);
  if ("error" in ctx) return ctx.error;
  const { order, user, isMentor, isStudent } = ctx;
  if (!isMentor && !isStudent) return NextResponse.json({ error: "Only the student or mentor can book a call" }, { status: 403 });
  if (order.status !== "IN_ESCROW") return NextResponse.json({ error: "Calls can be booked once the order is paid and in progress" }, { status: 400 });
  if (order.gig.callsIncluded === 0) return NextResponse.json({ error: "This package doesn't include a call" }, { status: 400 });
  if (order.disputed) return NextResponse.json({ error: "Calls can't be booked while a dispute is open" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a time" }, { status: 400 });
  try {
    const booking = await bookCall(order, start, { id: user.id, isMentor });
    return NextResponse.json({ booking });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params);
  if ("error" in ctx) return ctx.error;
  const { order, user, isMentor, isStudent } = ctx;
  if (!isMentor && !isStudent) return NextResponse.json({ error: "Only the student or mentor can move a call" }, { status: 403 });
  if (!["IN_ESCROW", "COMPLETED"].includes(order.status)) return NextResponse.json({ error: "This order is no longer active" }, { status: 400 });
  if (order.disputed) return NextResponse.json({ error: "Calls can't be moved while a dispute is open" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const booking = order.callBookings.find((b) => b.id === body.bookingId);
  if (!booking || booking.status !== "BOOKED") return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (!canChangeOnline(booking)) {
    return NextResponse.json(
      { error: `Calls can't be moved on the site within ${CANCEL_CUTOFF_HOURS} hours of the start. Message the other person, or contact us.` },
      { status: 400 }
    );
  }
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a new time" }, { status: 400 });
  try {
    const updated = await rescheduleCall(order, booking.id, start, { id: user.id, isMentor });
    return NextResponse.json({ booking: updated });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await load(params);
  if ("error" in ctx) return ctx.error;
  const { order, user, isAdmin } = ctx;
  const body = await req.json().catch(() => ({}));
  const booking = order.callBookings.find((b) => b.id === body.bookingId);
  if (!booking || booking.status !== "BOOKED") return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (!isAdmin && !canChangeOnline(booking)) {
    return NextResponse.json(
      { error: `Calls can't be cancelled on the site within ${CANCEL_CUTOFF_HOURS} hours of the start. Message the other person, or contact us.` },
      { status: 400 }
    );
  }
  const who = isAdmin ? "The MentorsMD team" : user.name || (order.sellerId === user.id ? "Your mentor" : "Your student");
  try {
    await cancelCall(order, booking.id, { id: user.id, name: who });
    return NextResponse.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
