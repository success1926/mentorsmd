import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDate } from "@/lib/validate";
import { callSummary, canChangeOnline, CANCEL_CUTOFF_HOURS } from "@/lib/calls";
import { sendCallBookedEmail, sendCallCancelledEmail, SITE_URL } from "@/lib/email";

// Manual booking - the fallback for mentors who don't use Cal.com. The
// two sides agree a time in messages, then the MENTOR locks it in here.
// Bookings made through Cal.com arrive via /api/webhooks/cal instead.
//
// Calls can only be booked on a paid order whose package includes one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { gig: true, callBookings: true, buyer: { select: { email: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = (session.user as any).id;
  if (order.sellerId !== userId) {
    return NextResponse.json({ error: "Only the mentor can add a call time by hand" }, { status: 403 });
  }

  const calls = callSummary(order);
  if (!calls.canBook) {
    return NextResponse.json(
      { error: order.gig.callsIncluded === 0 ? "This package doesn't include a call" : "All included calls are already booked" },
      { status: 400 }
    );
  }
  if (order.disputed) {
    return NextResponse.json({ error: "Calls can't be booked while a dispute is open" }, { status: 400 });
  }

  const { startTime } = await req.json();
  const start = parseDate(startTime);
  if (!start || start.getTime() < Date.now()) {
    return NextResponse.json({ error: "Pick a future date and time within the next year" }, { status: 400 });
  }
  const minutes = order.gig.callLength || 30;
  const end = new Date(start.getTime() + minutes * 60_000);

  const booking = await prisma.callBooking.create({
    data: { orderId: order.id, startTime: start, endTime: end, source: "MANUAL" },
  });
  // Clear the unbooked-call hold, and keep the old single-time field in
  // sync for anything that still reads it.
  await prisma.order.update({ where: { id: order.id }, data: { scheduledCallTime: start, callHoldAt: null } });

  try {
    await sendCallBookedEmail(order.buyer.email, order.gig.title, start, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send call-booked email:", err);
  }

  return NextResponse.json({ booking });
}

// Cancel a manually-added call (Cal.com bookings are cancelled on Cal.com,
// which tells us through the webhook). Either side can cancel up to the
// cutoff; after that, only an admin.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { bookingId } = await req.json().catch(() => ({}));
  if (typeof bookingId !== "string") return NextResponse.json({ error: "Missing booking" }, { status: 400 });

  const booking = await prisma.callBooking.findUnique({
    where: { id: bookingId },
    include: {
      order: { include: { gig: true, buyer: { select: { email: true } }, seller: { select: { email: true } } } },
    },
  });
  if (!booking || booking.orderId !== params.id) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const userId = (session.user as any).id;
  const isAdmin = (session.user as any).role === "ADMIN";
  const isBuyer = booking.order.buyerId === userId;
  const isSeller = booking.order.sellerId === userId;
  if (!isBuyer && !isSeller && !isAdmin) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  if (booking.status !== "BOOKED") return NextResponse.json({ error: "This call isn't active" }, { status: 400 });
  if (booking.source === "CAL" && !isAdmin) {
    return NextResponse.json({ error: "This call was booked on Cal.com - use the Cancel link to cancel it there" }, { status: 400 });
  }
  if (!isAdmin && !canChangeOnline(booking)) {
    return NextResponse.json(
      { error: `Calls can't be cancelled online within ${CANCEL_CUTOFF_HOURS} hours of the start. Message the other person, or contact us.` },
      { status: 400 }
    );
  }

  await prisma.callBooking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });

  const other = isBuyer ? booking.order.seller.email : booking.order.buyer.email;
  try {
    await sendCallCancelledEmail(other, booking.order.gig.title, `${SITE_URL}/orders/${booking.orderId}`);
  } catch (err) {
    console.error("Failed to send call-cancelled email:", err);
  }

  return NextResponse.json({ success: true });
}
