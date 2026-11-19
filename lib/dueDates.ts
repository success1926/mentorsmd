import { busyRangesFor } from "@/lib/callBooking";
import { nextFreeDay } from "@/lib/schedule";
import { addDays } from "@/lib/tz";

// The revision push: 7 days out, moved past the mentor's busy dates.
export async function revisionDueDay(mentorId: string, days: number) {
  const today = new Date().toISOString().slice(0, 10);
  const ranges = await busyRangesFor(mentorId, today);
  return nextFreeDay(addDays(today, days), ranges);
}
