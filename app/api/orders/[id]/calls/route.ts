import { NextResponse } from "next/server";
import { adminCan } from "@/lib/adminTeam";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDate } from "@/lib/validate";
import { canChangeOnline, isLateChange, CANCEL_CUTOFF_HOURS, LATE_REASON_MAX, LATE_REASON_MIN } from "@/lib/calls";
import { isBlockMinutes } from "@/lib/hours";
import { blockBetween } from "@/lib/blocks";
import { CallError, bookCall, cancelCall, orderForCallsInclude, rescheduleCall } from "@/lib/callBooking";
import { sendLive } from "@/lib/realtime";
import { gateBlockReason } from "@/lib/gate";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { aiCheckAndFlag, checkOutgoingMessage, flagSavedMessage } from "@/lib/messageSafety";
import { runAfterResponse } from "@/lib/request";

// Calls on one order (built-in calendar):
//   POST   { startTime }            book a call (student: an open slot; mentor: any agreed time)
//   PATCH  { bookingId, startTime } move a call (either side, until 24h before;
//          after that until the start with { reason }, which is posted to
//          the other person as a message in the package's thread)
//   DELETE { bookingId }            cancel a call (either side until 24h before; admins, or either side after a block, any time)
// Calls can only be booked on a paid order whose package includes one, or
// (hours orders, redesign Oct 2026) { startTime, minutes: 30 | 60 } that
// fits in the hours left.
async function load(params: { id: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const user = session.user as any;
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: orderForCallsInclude });
  const isAdmin = user.role === "ADMIN" && (await adminCan("calls"));
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
  // Hours orders: any 30- or 60-minute call that fits in the hours left
  // (checked in bookCall). Older packages: only the calls they include.
  if (!order.kind && order.gig.callsIncluded === 0) return NextResponse.json({ error: "This package doesn't include a call" }, { status: 400 });
  if (order.disputed) return NextResponse.json({ error: "Calls can't be booked while a dispute is open" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a time" }, { status: 400 });
  const minutes = Number(body.minutes);
  if (order.kind && !isBlockMinutes(minutes)) return NextResponse.json({ error: "Pick a 30- or 60-minute call" }, { status: 400 });
  try {
    const booking = await bookCall(order, start, { id: user.id, isMentor }, minutes);
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
  if (!(order.kind ? ["IN_ESCROW"] : ["IN_ESCROW", "COMPLETED"]).includes(order.status)) return NextResponse.json({ error: "This order is no longer active" }, { status: 400 });
  if (order.disputed) return NextResponse.json({ error: "Calls can't be moved while a dispute is open" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const booking = order.callBookings.find((b) => b.id === body.bookingId);
  if (!booking || booking.status !== "BOOKED") return NextResponse.json({ error: "Call not found" }, { status: 404 });
  const late = isLateChange(booking);
  if (!late && !canChangeOnline(booking)) return NextResponse.json({ error: "This call has already started." }, { status: 400 });
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a new time" }, { status: 400 });

  // Within 24 hours: a written reason, checked like any message.
  let reason = "";
  let lateMessage: { text: string; conversationId: string; findings: any[] } | null = null;
  if (late) {
    reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < LATE_REASON_MIN) {
      return NextResponse.json({ error: `With less than ${CANCEL_CUTOFF_HOURS} hours to go, please explain why you need to move the call (at least ${LATE_REASON_MIN} characters).`, code: "REASON_REQUIRED" }, { status: 400 });
    }
    if (reason.length > LATE_REASON_MAX) return NextResponse.json({ error: `Please keep the reason under ${LATE_REASON_MAX} characters.` }, { status: 400 });
    if (!order.conversationId) return NextResponse.json({ error: "This call can't be moved on the site this close to the start. Please contact us." }, { status: 400 });
    const gate = await gateBlockReason(user.id);
    if (gate) return NextResponse.json({ error: gate, code: "ACCOUNT_GATE" }, { status: 403 });
    for (const limit of [RATE_LIMITS.messagesPerMinute, RATE_LIMITS.messagesPerDay]) {
      const r = await rateLimit(limit, user.id);
      if (!r.ok) return tooMany(r.retryAfterSec, "You're sending messages too quickly. Please wait a moment and try again.");
    }
    const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, createdAt: true } });
    if (!sender) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const text = `I moved our call to a new time, less than ${CANCEL_CUTOFF_HOURS} hours before it was due to start.\n\nReason: ${reason}`;
    const verdict = await checkOutgoingMessage({ text, attachmentName: null, sender, conversationId: order.conversationId, acknowledgedWarnings: body.acknowledgeWarnings === true });
    if ("error" in verdict) return NextResponse.json({ error: verdict.error, code: verdict.code, warnings: verdict.warnings }, { status: verdict.status });
    lateMessage = { text, conversationId: order.conversationId, findings: verdict.findings };
  }

  try {
    const updated = await rescheduleCall(order, booking.id, start, { id: user.id, isMentor, name: user.name || (isMentor ? "Your mentor" : "Your student") }, late ? reason : undefined);
    if (lateMessage) {
      const message = await prisma.message.create({
        data: { body: lateMessage.text, conversationId: lateMessage.conversationId, senderId: user.id, orderId: order.id },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      await flagSavedMessage(lateMessage.findings, { id: message.id, body: lateMessage.text, attachmentName: null, senderId: user.id, conversationId: lateMessage.conversationId });
      runAfterResponse(() => aiCheckAndFlag(reason, "message", { subjectUserId: user.id, conversationId: lateMessage!.conversationId, messageId: message.id }));
      await prisma.conversation.update({
        where: { id: lateMessage.conversationId },
        data: isMentor ? { buyerUnread: { increment: 1 } } : { sellerUnread: { increment: 1 } },
      });
      await sendLive([order.buyerId, order.sellerId], "message", { conversationId: lateMessage.conversationId, message });
    }
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
  // After a block (e.g. a report), either side can cancel at any time.
  const blocks = await blockBetween(order.buyerId, order.sellerId);
  const blocked = blocks.iBlocked || blocks.theyBlocked;
  if (!isAdmin && !blocked && !canChangeOnline(booking)) {
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
