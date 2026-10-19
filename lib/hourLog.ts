// The hours log on an order (redesign Oct 2026, docs/redesign-2026-10.md
// section 4): CALL entries added automatically from call outcomes, WRITTEN
// entries logged by the mentor, and the "1 hour left" email. The maths is
// in lib/hours.ts. Server only.
import { prisma } from "@/lib/prisma";
import { COUNTS_AS_HELD } from "@/lib/callOutcomes";
import { callMinutes, hoursSummary, isBlockMinutes, shouldSendLowHours } from "@/lib/hours";
import { hoursLabel } from "@/lib/pricing";
import { SITE_URL, sendHoursLowEmail, sendWrittenTimeLoggedEmail } from "@/lib/email";

const hoursInclude = {
  hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true } },
  callBookings: { select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true } },
} as const;

export function loadOrderHours(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: hoursInclude });
}

// After a call's outcome is set (by the cron or an admin): a held call, or
// one the student didn't join, uses its booked time (a CALL entry); a
// mentor no-show, a free rebook or "nobody joined" uses nothing (any entry
// is voided). Only for hours orders. Safe to run any number of times.
export async function syncCallHourEntry(bookingId: string) {
  const b = await prisma.callBooking.findUnique({
    where: { id: bookingId },
    select: { id: true, startTime: true, endTime: true, status: true, outcome: true, orderId: true, order: { select: { kind: true } }, hourEntry: true },
  });
  if (!b?.orderId || !b.order?.kind) return;
  const counts = b.status !== "CANCELLED" && COUNTS_AS_HELD.includes(b.outcome || "");
  if (counts) {
    if (!b.hourEntry) {
      await prisma.hourEntry
        .create({
          data: {
            orderId: b.orderId,
            type: "CALL",
            minutes: callMinutes(b),
            workDate: b.startTime,
            note: b.outcome === "STUDENT_NO_SHOW" ? "Call (the student didn't join, so it counts as used)" : "Call held",
            callBookingId: b.id,
          },
        })
        .catch((err) => {
          // Two runs at once: the unique callBookingId stops the second.
          if (err?.code !== "P2002") throw err;
        });
    } else if (b.hourEntry.voidedAt) {
      await prisma.hourEntry.update({ where: { id: b.hourEntry.id }, data: { voidedAt: null } });
    }
    await maybeSendLowHours(b.orderId);
  } else if (b.hourEntry && !b.hourEntry.voidedAt) {
    await prisma.hourEntry.update({ where: { id: b.hourEntry.id }, data: { voidedAt: new Date() } });
  }
}

// "1 hour left": once, claimed before sending so two runs can't both email.
export async function maybeSendLowHours(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { ...hoursInclude, buyer: { select: { email: true } }, seller: { select: { name: true } }, gig: { select: { title: true } } },
    });
    if (!order?.kind || order.status !== "IN_ESCROW" || !shouldSendLowHours(order)) return;
    const claim = await prisma.order.updateMany({ where: { id: orderId, lowHoursEmailAt: null }, data: { lowHoursEmailAt: new Date() } });
    if (!claim.count) return;
    await sendHoursLowEmail(order.buyer.email, {
      packageTitle: order.packageTitle || order.gig.title,
      mentorName: order.seller.name,
      hoursLeft: hoursLabel(hoursSummary(order).left),
      orderUrl: `${SITE_URL}/orders/${order.id}`,
    });
  } catch (err) {
    console.error("1-hour-left email failed", orderId, err);
  }
}

export class HoursError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// The mentor logs written work: 30 or 60 minutes, the day it was done, a
// note, and optionally a file (already uploaded to private storage). It
// can't go over the hours left (booked calls count as used).
export async function logWrittenWork(
  orderId: string,
  mentorId: string,
  input: { minutes: unknown; workDate: Date; note: string; fileUrl?: string | null; fileName?: string | null }
) {
  if (!isBlockMinutes(input.minutes)) throw new HoursError("Log written work in 30- or 60-minute blocks.");
  const minutes = input.minutes;
  const entry = await prisma.$transaction(async (tx) => {
    // One change to this order's hours at a time.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"hours:" + orderId}))`;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: hoursInclude });
    if (!order || order.sellerId !== mentorId || !order.kind) throw new HoursError("Package not found", 404);
    if (order.status !== "IN_ESCROW") throw new HoursError("This package isn't active.");
    if (order.disputed) throw new HoursError("Hours can't be logged while a dispute is open.");
    if (order.markedCompleteAt) throw new HoursError("You've marked this package complete. The student is reviewing it.");
    const left = hoursSummary(order).left;
    if (left < minutes) throw new HoursError(left > 0 ? `Only ${left} minutes are left on this package.` : "No hours are left on this package. The student can add hours.");
    return tx.hourEntry.create({
      data: {
        orderId,
        type: "WRITTEN",
        minutes,
        workDate: input.workDate,
        note: input.note,
        fileUrl: input.fileUrl || null,
        fileName: input.fileUrl ? input.fileName || "File" : null,
        loggedById: mentorId,
      },
    });
  });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { ...hoursInclude, buyer: { select: { email: true } }, seller: { select: { name: true } }, gig: { select: { title: true } } },
  });
  if (order) {
    await sendWrittenTimeLoggedEmail(order.buyer.email, {
      mentorName: order.seller.name,
      packageTitle: order.packageTitle || order.gig.title,
      minutes: hoursLabel(minutes),
      note: input.note,
      hoursLeft: hoursLabel(hoursSummary(order).left),
      orderUrl: `${SITE_URL}/orders/${orderId}`,
    }).catch((err) => console.error("Written-time email failed", err));
    await maybeSendLowHours(orderId);
  }
  return entry;
}
