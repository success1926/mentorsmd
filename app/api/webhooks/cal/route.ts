import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendCallBookedEmail, sendCallCancelledEmail, SITE_URL } from "@/lib/email";
import { callSummary } from "@/lib/calls";

// Cal.com calls this when a student books, reschedules or cancels through
// a mentor's Cal.com page. The "Book a call" button adds the order id to
// the booking as metadata (?metadata[orderId]=...), which Cal.com sends
// back here - that's how each booking is matched to its order.
//
// Setup: on their Account page each mentor gets a webhook URL
// (/api/webhooks/cal?mentor=<their id>) and their own signing secret,
// which they paste into Cal.com (Settings -> Developer -> Webhooks) with
// the events Booking created, Booking rescheduled and Booking cancelled.
// Each mentor has their own secret, so one mentor can never post
// bookings onto another mentor's orders.
function validSignature(body: string, header: string | null, secret: string | null) {
  if (!secret || !header) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function pickVideoUrl(p: any): string | null {
  const candidates = [p?.metadata?.videoCallUrl, p?.videoCallData?.url, p?.location];
  for (const c of candidates) {
    if (typeof c === "string" && /^https:\/\//.test(c)) return c.slice(0, 1000);
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const mentorId = new URL(req.url).searchParams.get("mentor");
  const mentor = mentorId
    ? await prisma.user.findUnique({ where: { id: mentorId }, select: { id: true, role: true, calWebhookSecret: true } })
    : null;
  if (!mentor || mentor.role !== "SELLER" || !validSignature(body, req.headers.get("x-cal-signature-256"), mentor.calWebhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const trigger: string = event?.triggerEvent || "";
  const p = event?.payload || {};
  if (trigger === "PING") return NextResponse.json({ ok: true });

  const uid: string | undefined = typeof p.uid === "string" ? p.uid : undefined;
  const orderId: string | undefined = typeof p?.metadata?.orderId === "string" ? p.metadata.orderId : undefined;
  const start = p.startTime ? new Date(p.startTime) : null;
  const end = p.endTime ? new Date(p.endTime) : null;

  if (trigger === "BOOKING_CANCELLED") {
    if (!uid) return NextResponse.json({ ok: true });
    const existing = await prisma.callBooking.findUnique({
      where: { calUid: uid },
      include: { order: { include: { gig: true, buyer: { select: { email: true } }, seller: { select: { email: true } } } } },
    });
    if (existing && existing.status === "BOOKED" && existing.order.sellerId === mentor.id) {
      await prisma.callBooking.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
      const url = `${SITE_URL}/orders/${existing.orderId}`;
      await Promise.all(
        [existing.order.buyer.email, existing.order.seller.email].map((to) =>
          sendCallCancelledEmail(to, existing.order.gig.title, url).catch((e) => console.error("cal cancel email", e))
        )
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (trigger !== "BOOKING_CREATED" && trigger !== "BOOKING_RESCHEDULED") {
    return NextResponse.json({ ok: true, ignored: trigger });
  }
  if (!uid || !start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Missing booking details" }, { status: 400 });
  }

  // Rescheduling creates a new Cal.com uid; move our row over to it.
  const oldUid: string | undefined = typeof p.rescheduleUid === "string" ? p.rescheduleUid : undefined;
  const existing =
    (await prisma.callBooking.findUnique({ where: { calUid: uid } })) ||
    (oldUid ? await prisma.callBooking.findUnique({ where: { calUid: oldUid } }) : null);

  if (existing) {
    const owner = await prisma.order.findUnique({ where: { id: existing.orderId }, select: { sellerId: true } });
    if (owner?.sellerId !== mentor.id) return NextResponse.json({ ok: true, ignored: "not this mentor's order" });
  }

  const meetingUrl = pickVideoUrl(p);
  let bookingOrderId: string | null = null;

  if (existing) {
    await prisma.callBooking.update({
      where: { id: existing.id },
      data: { calUid: uid, startTime: start, endTime: end, status: "BOOKED", meetingUrl: meetingUrl ?? existing.meetingUrl, reminderSentAt: null },
    });
    bookingOrderId = existing.orderId;
  } else {
    if (!orderId) {
      // A booking made on the mentor's Cal.com page directly, not through
      // an order - nothing to attach it to.
      return NextResponse.json({ ok: true, ignored: "no orderId in metadata" });
    }
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { gig: true, callBookings: true } });
    // Paid, not disputed, and still has an included call left to book
    // (not skipped, not forfeited, not already fully booked).
    if (!order || order.sellerId !== mentor.id || order.disputed || !callSummary(order).canBook) {
      return NextResponse.json({ ok: true, ignored: "order not bookable" });
    }
    // New bookings must be in the future.
    if (start.getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ ok: true, ignored: "start time in the past" });
    }
    await prisma.callBooking.create({
      data: { orderId: order.id, startTime: start, endTime: end, source: "CAL", calUid: uid, meetingUrl },
    });
    bookingOrderId = order.id;
  }

  await prisma.order.update({ where: { id: bookingOrderId }, data: { callHoldAt: null, scheduledCallTime: start } });

  const order = await prisma.order.findUnique({
    where: { id: bookingOrderId },
    include: { gig: true, buyer: { select: { email: true } }, seller: { select: { email: true } } },
  });
  if (order) {
    const url = `${SITE_URL}/orders/${order.id}`;
    await Promise.all(
      [order.buyer.email, order.seller.email].map((to) =>
        sendCallBookedEmail(to, order.gig.title, start, url, trigger === "BOOKING_RESCHEDULED").catch((e) =>
          console.error("cal booked email", e)
        )
      )
    );
  }

  return NextResponse.json({ ok: true });
}
