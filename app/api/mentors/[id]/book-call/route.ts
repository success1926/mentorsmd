import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDate } from "@/lib/validate";
import { CallError, bookCall, orderForCallsInclude } from "@/lib/callBooking";
import { CheckoutError, startPayPerCallCheckout } from "@/lib/hourCheckout";
import { isBlockMinutes } from "@/lib/hours";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

// "Book a call" with a mentor: { startTime, minutes: 30 | 60, orderId? }.
//   orderId: book it from that package's hours (no payment).
//   no orderId: a pay-per-call order at the mentor's hourly rate; answers
//   { url } (Stripe Checkout, or the paid package when credit covered it),
//   and the call is booked when the payment clears.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can book a call" }, { status: 403 });
  }
  const studentId = (session.user as any).id;
  const r = await rateLimit(RATE_LIMITS.messagesPerMinute, `book:${studentId}`);
  if (!r.ok) return tooMany(r.retryAfterSec, "Please wait a moment and try again.");
  const body = await req.json().catch(() => ({}));
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a time" }, { status: 400 });
  const minutes = Number(body.minutes);
  if (!isBlockMinutes(minutes)) return NextResponse.json({ error: "Pick a 30- or 60-minute call" }, { status: 400 });
  try {
    if (typeof body.orderId === "string") {
      const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: orderForCallsInclude });
      if (!order || order.buyerId !== studentId || order.sellerId !== params.id || !order.kind) {
        return NextResponse.json({ error: "Package not found" }, { status: 404 });
      }
      const booking = await bookCall(order, start, { id: studentId, isMentor: false }, minutes);
      return NextResponse.json({ booking: { id: booking.id, startTime: booking.startTime, endTime: booking.endTime }, orderId: order.id });
    }
    const { url, orderId } = await startPayPerCallCheckout({ id: studentId, email: session.user.email }, params.id, start, minutes);
    return NextResponse.json({ url, orderId });
  } catch (err) {
    if (err instanceof CallError || err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Booking a call failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
