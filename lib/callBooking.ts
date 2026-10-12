// Server side of the built-in calendar: works out a mentor's open slots,
// and books, moves and cancels calls (with the Daily room, emails and
// calendar invites). Server only.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callSummary } from "@/lib/calls";
import { BusyRange, Interval, generateSlots, BOOKING_HORIZON_DAYS } from "@/lib/schedule";
import { addDays, dayInZone, tzOrDefault } from "@/lib/tz";
import { EXTERNAL_CAL_CACHE_MINUTES, fetchIcal, parseIcalBusy } from "@/lib/icalBusy";
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
  daysOff: true,
  externalCalUrl: true,
  externalBusy: true,
  externalBusyFetchedAt: true,
} as const;

export const orderForCallsInclude = {
  gig: true,
  callBookings: true,
  buyer: { select: { id: true, name: true, email: true, timeZone: true } },
  seller: { select: mentorScheduleSelect },
} satisfies Prisma.OrderInclude;

export type OrderForCalls = Prisma.OrderGetPayload<{ include: typeof orderForCallsInclude }>;
type MentorForSchedule = OrderForCalls["seller"];

// ---------- The mentor's own calendar (secret iCal address) ----------

// Busy times from the mentor's Google/iCloud calendar, re-read at most
// every 15 minutes. If the calendar can't be read, the last good copy is
// used and the error is shown on their Account page.
export async function externalBusyFor(mentor: MentorForSchedule, force = false): Promise<Interval[]> {
  if (!mentor.externalCalUrl) return [];
  const fresh =
    mentor.externalBusyFetchedAt && Date.now() - mentor.externalBusyFetchedAt.getTime() < EXTERNAL_CAL_CACHE_MINUTES * 60_000;
  const cached = Array.isArray(mentor.externalBusy) ? (mentor.externalBusy as any[]) : [];
  const fromCache = () => cached.map((b) => ({ s: Date.parse(b.s), e: Date.parse(b.e) })).filter((b) => b.s && b.e);
  if (fresh && !force) return fromCache();
  try {
    const text = await fetchIcal(mentor.externalCalUrl);
    const from = Date.now() - 24 * 3600_000;
    const to = Date.now() + (BOOKING_HORIZON_DAYS + 2) * 24 * 3600_000;
    const busy = parseIcalBusy(text, tzOrDefault(mentor.timeZone), from, to);
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

// Calls already booked by the mentor (any order) or by this student, as
// busy intervals.
async function bookedIntervals(mentorId: string, studentId: string, excludeBookingId?: string): Promise<Interval[]> {
  const rows = await prisma.callBooking.findMany({
    where: {
      status: "BOOKED",
      endTime: { gt: new Date(Date.now() - 3600_000) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      order: { OR: [{ sellerId: mentorId }, { buyerId: studentId }], status: { in: ["IN_ESCROW", "COMPLETED"] } },
    },
    select: { startTime: true, endTime: true },
    take: 2000,
  });
  return rows.map((r) => ({ s: r.startTime.getTime(), e: r.endTime.getTime() }));
}

export async function openSlotsForOrder(order: OrderForCalls, opts: { excludeBookingId?: string; onlyDay?: string } = {}) {
  const mentor = order.seller;
  const tz = tzOrDefault(mentor.timeZone);
  const [ranges, booked, external] = await Promise.all([
    busyRangesFor(mentor.id, addDays(dayInZone(new Date(), tz), -1)),
    bookedIntervals(mentor.id, order.buyerId, opts.excludeBookingId),
    externalBusyFor(mentor),
  ]);
  return generateSlots({
    weeklyHours: mentor.weeklyHours,
    timeZone: tz,
    bufferMinutes: mentor.bufferMinutes,
    minNoticeHours: mentor.minNoticeHours,
    daysOff: mentor.daysOff || [],
    busyRanges: ranges,
    busy: [...booked, ...external],
    lengthMinutes: order.gig.callLength || 30,
    onlyDay: opts.onlyDay,
  });
}

// ---------- Emails + invites ----------

function callEmail(order: OrderForCalls, booking: { id: string; startTime: Date; endTime: Date; icsSequence: number }, to: "buyer" | "seller", method: "REQUEST" | "CANCEL"): CallEmail & { email: string } {
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
    description: `${order.gig.title}\nJoin here: ${joinUrl}\nOrder: ${orderUrl}`,
    url: joinUrl,
    organizerEmail: fromAddress(),
    attendees: [{ name: me.name, email: me.email }],
  });
  return {
    email: me.email,
    gigTitle: order.gig.title,
    start: booking.startTime,
    end: booking.endTime,
    timeZone: tzOrDefault(me.timeZone),
    otherName: other.name,
    orderUrl,
    joinUrl,
    ics,
  };
}

async function emailBoth(order: OrderForCalls, booking: any, kind: "booked" | "rescheduled" | "cancelled", byName?: string) {
  await Promise.all(
    (["buyer", "seller"] as const).map(async (who) => {
      const c = callEmail(order, booking, who, kind === "cancelled" ? "CANCEL" : "REQUEST");
      try {
        if (kind === "cancelled") await sendCallCancelledEmail(c.email, c, byName || "Someone");
        else await sendCallScheduledEmail(c.email, c, kind === "rescheduled");
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

// Locks the mentor's calendar for the rest of the transaction, so two
// students can't grab the same slot at the same moment.
async function lockMentor(tx: Prisma.TransactionClient, mentorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${mentorId}))`;
}

async function assertNoClash(tx: Prisma.TransactionClient, order: OrderForCalls, start: Date, end: Date, bufferMin: number, excludeId?: string) {
  const buffer = bufferMin * 60_000;
  const clash = await tx.callBooking.findFirst({
    where: {
      status: "BOOKED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: new Date(end.getTime() + buffer) },
      endTime: { gt: new Date(start.getTime() - buffer) },
      order: { OR: [{ sellerId: order.sellerId }, { buyerId: order.buyerId }], status: { in: ["IN_ESCROW", "COMPLETED"] } },
    },
    select: { id: true },
  });
  if (clash) throw new CallError("That time was just taken. Please pick another.", 409);
}

// Books a new call on the order. Students must pick an open slot; the
// mentor can enter any future time they agreed with the student.
export async function bookCall(order: OrderForCalls, start: Date, by: { id: string; isMentor: boolean }) {
  const length = (order.gig.callLength || 30) * 60_000;
  const end = new Date(start.getTime() + length);
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CallError("Pick a time in the future.");
  if (!by.isMentor) {
    const slots = await openSlotsForOrder(order, { onlyDay: dayInZone(start, tzOrDefault(order.seller.timeZone)) });
    if (!slots.some((s) => s.getTime() === start.getTime())) throw new CallError("That time isn't available anymore. Please pick another.", 409);
  }

  const booking = await prisma.$transaction(async (tx) => {
    await lockMentor(tx, order.sellerId);
    const fresh = await tx.order.findUnique({ where: { id: order.id }, include: { gig: true, callBookings: true } });
    if (!fresh || !callSummary(fresh).canBook || fresh.disputed) throw new CallError("No calls are left to book on this order.");
    await assertNoClash(tx, order, start, end, by.isMentor ? 0 : order.seller.bufferMinutes);
    const created = await tx.callBooking.create({
      data: {
        orderId: order.id,
        startTime: start,
        endTime: end,
        status: "BOOKED",
        source: by.isMentor ? "MANUAL" : "SITE",
        scheduledAt: new Date(),
        bookedById: by.id,
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { scheduledCallTime: start, callHoldAt: null } });
    return created;
  });

  const room = await ensureRoom(booking).catch(() => null);
  const saved = room
    ? await prisma.callBooking.update({ where: { id: booking.id }, data: { roomName: room.name, roomUrl: room.url } })
    : booking;
  await emailBoth(order, saved, "booked");
  return saved;
}

export async function rescheduleCall(order: OrderForCalls, bookingId: string, start: Date, by: { id: string; isMentor: boolean }) {
  const current = order.callBookings.find((b) => b.id === bookingId);
  if (!current || current.status !== "BOOKED") throw new CallError("Call not found", 404);
  const length = (order.gig.callLength || 30) * 60_000;
  const end = new Date(start.getTime() + length);
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CallError("Pick a time in the future.");
  if (!by.isMentor) {
    const slots = await openSlotsForOrder(order, { excludeBookingId: bookingId, onlyDay: dayInZone(start, tzOrDefault(order.seller.timeZone)) });
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
    await tx.order.update({ where: { id: order.id }, data: { scheduledCallTime: start, callHoldAt: null } });
    return tx.callBooking.findUniqueOrThrow({ where: { id: bookingId } });
  });

  const room = await ensureRoom(updated).catch(() => null);
  const saved =
    room && room.name !== updated.roomName
      ? await prisma.callBooking.update({ where: { id: updated.id }, data: { roomName: room.name, roomUrl: room.url } })
      : updated;
  await emailBoth(order, saved, "rescheduled");
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
