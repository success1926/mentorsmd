import { prisma } from "@/lib/prisma";
import { busyRangesFor } from "@/lib/callBooking";
import { BusyRange, dueDateExplanation, earliestDueDay, nextFreeDay } from "@/lib/schedule";
import { addDays, dayInZone, tzOrDefault } from "@/lib/tz";

// "Today" for a student, in their own time zone (or the default zone).
export async function todayFor(userId: string | null | undefined) {
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } }) : null;
  return dayInZone(new Date(), tzOrDefault(user?.timeZone));
}

// Everything the checkout date picker needs. Busy-date notes stay private.
export async function dueDateRules(mentorId: string, turnaround: string | null, today: string) {
  const ranges: BusyRange[] = await busyRangesFor(mentorId, today);
  const earliest = earliestDueDay(today, turnaround, ranges);
  return {
    today,
    earliest,
    latest: addDays(today, 365),
    busy: ranges.map((r) => ({ startDay: r.startDay, endDay: r.endDay })),
    explanation: dueDateExplanation(turnaround, earliest, ranges, today),
  };
}

// The revision push: 7 days out, moved past the mentor's busy dates.
export async function revisionDueDay(mentorId: string, days: number) {
  const today = new Date().toISOString().slice(0, 10);
  const ranges = await busyRangesFor(mentorId, today);
  return nextFreeDay(addDays(today, days), ranges);
}
