// Server side of the built-in calendar: works out a mentor's open slots,
// and books, moves and cancels calls (with the Daily room, emails and
// calendar invites). Server only.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callSummary } from "@/lib/calls";
import { callMinutes, hoursSummary, isBlockMinutes } from "@/lib/hours";
import { finishPhase } from "@/lib/finishing";
import { blockBetween } from "@/lib/blocks";
import { maybeSendLowHours } from "@/lib/hourLog";
import { BusyRange, Interval, generateSlots, MAX_BOOKING_WINDOW_DAYS, bookingWindowFor } from "@/lib/schedule";
import { addDays, dayInZone, tzOrDefault } from "@/lib/tz";
import { EXTERNAL_CAL_CACHE_MINUTES, fetchIcal, parseIcalBusy } from "@/lib/icalBusy";
import { googleBusy } from "@/lib/googleCalendar";
import { deleteRoom, ensureRoom } from "@/lib/daily";
import { buildCallIcs } from "@/lib/ics";
import { CallEmail, SITE_URL, fromAddress, sendCallCancelledEmail, sendCallScheduledEmail } from "@/lib/email";

export const mentorScheduleSelect = {
  id: true,
  name: true,
  email: true,
  timeZone: true,
  weeklyHours: true,
  bufferMinutes: true,
  minNoticeHours: true,
  bookingWindowDays: true,
  daysOff: true,
  externalCalUrl: true,
  externalBusy: true,
  externalBusyFetchedAt: true,
  // Not the token itself: lib/googleCalendar.ts loads that only when needed.
  googleCalConnectedAt: true,
} as const;

export const orderForCallsInclude = {
  gig: true,
  callBookings: true,
  // Hours orders (redesign Oct 2026): what's used, for the hours-left check.
  hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true } },
  buyer: { select: { id: true, name: true, email: true, timeZone: true } },
  seller: { select: mentorScheduleSelect },
} satisfies Prisma.OrderInclude;

export type OrderForCalls = Prisma.OrderGetPayload<{ include: typeof orderForCallsInclude }>;
export type MentorForSchedule = OrderForCalls["seller"];

// ---------- The mentor's own calendar (Google connection and/or iCal link) ----------

// Busy times from the mentor's own calendar, re-read at most every 15
// minutes. If Google Calendar is connected AND an iCal link is pasted, the
// busy times from both are combined (a mentor may keep work and personal
// calendars apart). If either can't be read, the last good copy is used
// and the error is shown on their Account page.
export async function externalBusyFor(mentor: MentorForSchedule, force = false): Promise<Interval[]> {
  const google = !!mentor.googleCalConnectedAt;
  const icalUrl = mentor.externalCalUrl;
  if (!icalUrl && !google) return [];
  const fresh =
    mentor.externalBusyFetchedAt && Date.now() - mentor.externalBusyFetchedAt.getTime() < EXTERNAL_CAL_CACHE_MINUTES * 60_000;
  const cached = Array.isArray(mentor.externalBusy) ? (mentor.externalBusy as any[]) : [];
  const fromCache = () => cached.map((b) => ({ s: Date.parse(b.s), e: Date.parse(b.e) })).filter((b) => b.s && b.e);
  if (fresh && !force) return fromCache();
  try {
    const from = Date.now() - 24 * 3600_000;
    // Every window a mentor can pick, so changing it needs no re-read.
    const to = Date.now() + (MAX_BOOKING_WINDOW_DAYS + 2) * 24 * 3600_000;
    const parts = await Promise.all([
      google ? googleBusy(mentor.id, from, to) : Promise.resolve([] as Interval[]),
      icalUrl ? fetchIcal(icalUrl).then((text) => parseIcalBusy(text, tzOrDefault(mentor.timeZone), from, to)) : Promise.resolve([] as Interval[]),
    ]);
    const busy = parts.flat().sort((a, b) => a.s - b.s);
    await prisma.user.update({
      where: { id: mentor.id },
      data: {
        externalBusy: busy.map((b) => ({ s: new Date(b.s).toISOString(), e: new Date(b.e).toISOString() })),
        externalBusyFetchedAt: new Date(),
        externalCalError: null,
      },
    });
    return busy;
  } catch (err: any) {
    // Wait before trying again, and keep using the last good copy.
    await prisma.user
      .update({
        where: { id: mentor.id },
        data: { externalBusyFetchedAt: new Date(), externalCalError: String(err?.message || "Couldn't read the calendar").slice(0, 300) },
      })
      .catch(() => {});
    if (force) throw err;
    return fromCache();
  }
}

// ---------- Busy dates ----------

export async function busyRangesFor(mentorId: string, fromDay?: string): Promise<BusyRange[]> {
  const rows = await prisma.busyDate.findMany({
    where: { userId: mentorId, ...(fromDay ? { endDay: { gte: fromDay } } : {}) },
    select: { startDay: true, endDay: true, kind: true },
    orderBy: { startDay: "asc" },
    take: 500,
  });
  return rows;
}

// ---------- Open slots ----------

// The calls that keep a mentor or a student busy: calls on their active
// orders, and free intro calls (no order; redesign Oct 2026).
export function busyCallsWhere(mentorId: string, studentId: string): Prisma.CallBookingWhereInput {
  return {
    OR: [
      { order: { OR: [{ sellerId: mentorId }, { buyerId: studentId }], status: { in: ["IN_ESCROW", "COMPLETED"] } } },
      { kind: "INTRO", OR: [{ mentorId }, { studentId }] },
    ],
  };
}

// Calls already booked by the mentor (any order, or an intro call) or by
// this student, as busy intervals.
export async function bookedIntervals(mentorId: string, studentId: string, excludeBookingId?: string): Promise<Interval[]> {
  const rows = await prisma.callBooking.findMany({
    where: {
      status: "BOOKED",
      endTime: { gt: new Date(Date.now() - 3600_000) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      ...busyCallsWhere(mentorId, studentId),
    },
    select: { startTime: true, endTime: true },
    take: 2000,
  });
  return rows.map((r) => ({ s: r.startTime.getTime(), e: r.endTime.getTime() }));
}

// Open start times on a mentor's calendar for a call of this length, for
// this student (their own other calls are kept free too).
export async function openSlotsFor(
  mentor: MentorForSchedule,
  studentId: string,
  lengthMinutes: number,
  // ignoreNotice: the time was already checked against the mentor's
  // minimum notice earlier (pay-per-call, picked before paying).
  opts: { excludeBookingId?: string; onlyDay?: string; ignoreNotice?: boolean } = {}
) {
  const tz = tzOrDefault(mentor.timeZone);
  const [ranges, booked, external] = await Promise.all([
    busyRangesFor(mentor.id, addDays(dayInZone(new Date(), tz), -1)),
    bookedIntervals(mentor.id, studentId, opts.excludeBookingId),
    externalBusyFor(mentor),
  ]);
  return generateSlots({
    weeklyHours: mentor.weeklyHours,
    timeZone: tz,
    bufferMinutes: mentor.bufferMinutes,
    minNoticeHours: opts.ignoreNotice ? 0 : mentor.minNoticeHours,
    daysOff: mentor.daysOff || [],
    busyRanges: ranges,
    busy: [...booked, ...external],
    lengthMinutes,
    horizonDays: bookingWindowFor(mentor.bookingWindowDays),
    onlyDay: opts.onlyDay,
  });
}

// The title shown for an order: the package snapshot taken at checkout
// (hours orders), or the package itself (orders from before the redesign).
export const orderTitle = (o: { packageTitle?: string | null; gig: { title: string } }) => o.packageTitle || o.gig.title;

// Length of a call on this order: hours orders choose 30 or 60 minutes per
// call (lengthMinutes); older packages have a fixed call length.
function lengthFor(order: OrderForCalls, lengthMinutes?: number) {
  if (order.kind) return isBlockMinutes(lengthMinutes) ? lengthMinutes : 60;
  return order.gig.callLength || 30;
}

export async function openSlotsForOrder(order: OrderForCalls, opts: { excludeBookingId?: string; onlyDay?: string; lengthMinutes?: number; ignoreNotice?: boolean } = {}) {
  return openSlotsFor(order.seller, order.buyerId, lengthFor(order, opts.lengthMinutes), opts);
}

// Why a call of this length can't be booked from this hours order, or null.
export function hoursBookingBlocker(order: Pick<OrderForCalls, "status" | "disputed" | "minutesPurchased" | "hourEntries" | "callBookings" | "markedCompleteAt" | "responseDeadline" | "approvedAt" | "lastCallUsedAt" | "lastRevisionUsedAt">, minutes: number) {
  if (order.status !== "IN_ESCROW") return "This package isn't active.";
  if (order.disputed) return "Calls can't be booked while a dispute is open.";
  if (finishPhase(order) === "AWAITING_STUDENT") return "Your mentor marked this package complete. To book another call, choose \"Request one last call\" first.";
  const left = hoursSummary(order).left;
  if (left < minutes) return left > 0 ? `Only ${left} minutes are left on this package. Add hours, or book a shorter call.` : "No hours are left on this package. Add hours to book another call.";
  return null;
}

// ---------- Emails + invites ----------

function callEmail(order: OrderForCalls, booking: { id: string; startTime: Date; endTime: Date; icsSequence: number }, to: "buyer" | "seller", method: "REQUEST" | "CANCEL"): CallEmail & { email: string } {
  const title = orderTitle(order);
  const me = to === "buyer" ? order.buyer : order.seller;
  const other = to === "buyer" ? order.seller : order.buyer;
  const orderUrl = `${SITE_URL}/orders/${order.id}`;
  const joinUrl = `${SITE_URL}/calls/${booking.id}`;
  const ics = buildCallIcs({
    bookingId: booking.id,
    method,
    sequence: booking.icsSequence,
    start: booking.startTime,
    end: booking.endTime,
    summary: `MentorsMD call with ${other.name}`,
    description: `${title}\nJoin here: ${joinUrl}\nOrder: ${orderUrl}`,
    url: joinUrl,
    organizerEmail: fromAddress(),
    attendees: [{ name: me.name, email: me.email }],
  });
  return {
    email: me.email,
    gigTitle: title,
    start: booking.startTime,
    end: booking.endTime,
    timeZone: tzOrDefault(me.timeZone),
    otherName: other.name,
    orderUrl,
    joinUrl,
    ics,
  };
}

async function emailBoth(order: OrderForCalls, booking: any, kind: "booked" | "rescheduled" | "cancelled", byName?: string, lateReason?: string) {
  await Promise.all(
    (["buyer", "seller"] as const).map(async (who) => {
      const c = callEmail(order, booking, who, kind === "cancelled" ? "CANCEL" : "REQUEST");
      try {
        if (kind === "cancelled") await sendCallCancelledEmail(c.email, c, byName || "Someone");
        else await sendCallScheduledEmail(c.email, c, kind === "rescheduled", lateReason ? { by: byName || "Someone", reason: lateReason } : undefined);
      } catch (err) {
        console.error(`Call ${kind} email failed`, err);
      }
    })
  );
}

// ---------- Book / move / cancel ----------

export class CallError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// A block (e.g. after a report) also stops booking or moving calls, even on
// hours already bought; an admin sorts out the package.
async function assertNotBlocked(order: { buyerId: string; sellerId: string }) {
  const blocks = await blockBetween(order.buyerId, order.sellerId);
  if (blocks.iBlocked || blocks.theyBlocked) throw new CallError("Calls can't be booked between you two right now. Contact us if you need help.", 403);
}

// Locks the mentor's calendar for the rest of the transaction, so two
// students can't grab the same slot at the same moment.
export async function lockMentor(tx: Prisma.TransactionClient, mentorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mentorId}))`;
}

// Any booked call (an order call or an intro call) of this mentor or this
// student within the buffer of [start, end)?
export async function assertNoClashFor(
  tx: Prisma.TransactionClient,
  mentorId: string,
  studentId: string,
  start: Date,
  end: Date,
  bufferMin: number,
  excludeId?: string
) {
  const buffer = bufferMin * 60_000;
  const clash = await tx.callBooking.findFirst({
    where: {
      status: "BOOKED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: new Date(end.getTime() + buffer) },
      endTime: { gt: new Date(start.getTime() - buffer) },
      ...busyCallsWhere(mentorId, studentId),
    },
    select: { id: true },
  });
  if (clash) throw new CallError("That time was just taken. Please pick another.", 409);
}

function assertNoClash(tx: Prisma.TransactionClient, order: OrderForCalls, start: Date, end: Date, bufferMin: number, excludeId?: string) {
  return assertNoClashFor(tx, order.sellerId, order.buyerId, start, end, bufferMin, excludeId);
}

// Books a new call on the order. Students must pick an open slot; the
// mentor can enter any future time they agreed with the student. On an
// hours order the call is 30 or 60 minutes (lengthMinutes) and has to fit
// in the hours left (booked calls hold their minutes until they're logged).
// pickedBeforePayment: pay-per-call. The time passed the mentor's minimum
// notice when the student picked it; paying can take a few minutes, so it
// isn't checked again (it must still be free and in the mentor's hours).
export async function bookCall(order: OrderForCalls, start: Date, by: { id: string; isMentor: boolean }, lengthMinutes?: number, opts: { pickedBeforePayment?: boolean } = {}) {
  const minutes = lengthFor(order, lengthMinutes);
  const length = minutes * 60_000;
  const end = new Date(start.getTime() + length);
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CallError("Pick a time in the future.");
  await assertNotBlocked(order);
  if (!by.isMentor) {
    const slots = await openSlotsForOrder(order, { onlyDay: dayInZone(start, tzOrDefault(order.seller.timeZone)), lengthMinutes: minutes, ignoreNotice: opts.pickedBeforePayment });
    if (!slots.some((s) => s.getTime() === start.getTime())) throw new CallError("That time isn't available anymore. Please pick another.", 409);
  }

  const booking = await prisma.$transaction(async (tx) => {
    await lockMentor(tx, order.sellerId);
    // Same lock as logging written work (lib/hourLog.ts), so the two can't
    // both use the last minutes.
    if (order.kind) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hours:" + order.id}))`;
    const fresh = await tx.order.findUnique({ where: { id: order.id }, include: { gig: true, callBookings: true, hourEntries: true } });
    if (!fresh) throw new CallError("Order not found", 404);
    if (fresh.kind) {
      const blocked = hoursBookingBlocker(fresh, minutes);
      if (blocked) throw new CallError(blocked);
    } else if (!callSummary(fresh).canBook || fresh.disputed) {
      throw new CallError("No calls are left to book on this order.");
    }
    await assertNoClash(tx, order, start, end, by.isMentor ? 0 : order.seller.bufferMinutes);
    const created = await tx.callBooking.create({
      data: {
        orderId: order.id,
        studentId: order.buyerId,
        mentorId: order.sellerId,
        startTime: start,
        endTime: end,
        status: "BOOKED",
        source: by.isMentor ? "MANUAL" : "SITE",
        scheduledAt: new Date(),
        bookedById: by.id,
      },
    });
    // Due-date era fields; hours orders don't use them.
    if (!fresh.kind) await tx.order.update({ where: { id: order.id }, data: { scheduledCallTime: start, callHoldAt: null } });
    // Pay-per-call whose first pick was taken: this is its call now.
    else if (fresh.requestedCallStart) await tx.order.update({ where: { id: order.id }, data: { requestedCallStart: null } });
    return created;
  });

  const room = await ensureRoom(booking).catch(() => null);
  const saved = room
    ? await prisma.callBooking.update({ where: { id: booking.id }, data: { roomName: room.name, roomUrl: room.url } })
    : booking;
  await emailBoth(order, saved, "booked");
  if (order.kind) await maybeSendLowHours(order.id);
  return saved;
}

// lateReason: moved within 24 hours of the start; the caller posts it as
// a message, and it's quoted in both emails.
export async function rescheduleCall(order: OrderForCalls, bookingId: string, start: Date, by: { id: string; isMentor: boolean; name?: string }, lateReason?: string) {
  const current = order.callBookings.find((b) => b.id === bookingId);
  if (!current || current.status !== "BOOKED") throw new CallError("Call not found", 404);
  // A moved call keeps its length (hours orders: the 30 or 60 booked).
  const minutes = order.kind ? callMinutes(current) : lengthFor(order);
  const length = minutes * 60_000;
  const end = new Date(start.getTime() + length);
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CallError("Pick a time in the future.");
  await assertNotBlocked(order);
  if (!by.isMentor) {
    const slots = await openSlotsForOrder(order, { excludeBookingId: bookingId, onlyDay: dayInZone(start, tzOrDefault(order.seller.timeZone)), lengthMinutes: minutes });
    if (!slots.some((s) => s.getTime() === start.getTime())) throw new CallError("That time isn't available anymore. Please pick another.", 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockMentor(tx, order.sellerId);
    await assertNoClash(tx, order, start, end, by.isMentor ? 0 : order.seller.bufferMinutes, bookingId);
    const res = await tx.callBooking.updateMany({
      where: { id: bookingId, status: "BOOKED" },
      data: {
        startTime: start,
        endTime: end,
        scheduledAt: new Date(),
        bookedById: by.id,
        icsSequence: { increment: 1 },
        // A new time means fresh reminders.
        morningReminderStudentAt: null,
        morningReminderMentorAt: null,
        hourReminderAt: null,
        reminderSentAt: null,
      },
    });
    if (res.count === 0) throw new CallError("This call changed. Refresh the page.", 409);
    if (!order.kind) await tx.order.update({ where: { id: order.id }, data: { scheduledCallTime: start, callHoldAt: null } });
    return tx.callBooking.findUniqueOrThrow({ where: { id: bookingId } });
  });

  const room = await ensureRoom(updated).catch(() => null);
  const saved =
    room && room.name !== updated.roomName
      ? await prisma.callBooking.update({ where: { id: updated.id }, data: { roomName: room.name, roomUrl: room.url } })
      : updated;
  await emailBoth(order, saved, "rescheduled", by.name, lateReason);
  return saved;
}

export async function cancelCall(order: OrderForCalls, bookingId: string, by: { id: string; name: string }) {
  const res = await prisma.callBooking.updateMany({
    where: { id: bookingId, orderId: order.id, status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: by.id, icsSequence: { increment: 1 } },
  });
  if (res.count === 0) throw new CallError("This call isn't active anymore. Refresh the page.", 409);
  const booking = await prisma.callBooking.findUniqueOrThrow({ where: { id: bookingId } });
  await deleteRoom(booking.roomName).catch(() => {});
  await emailBoth(order, booking, "cancelled", by.name);
  return booking;
}
