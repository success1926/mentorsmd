import { prisma } from "@/lib/prisma";
import { CallEmail, SITE_URL, sendCallReminderEmail } from "@/lib/email";
import { dayInZone, tzOrDefault, zonedToUtc } from "@/lib/tz";

// Call reminders, for both the student and the mentor:
//   - morning-of: 8am in each person's own time zone, on the day of the call
//   - 1 hour before, with the Join link
// Each is sent once (the sent time is stored on the call). Moving a call
// clears them so they're sent again for the new time; cancelled calls are
// skipped. Meant to run every 15 minutes (see /api/cron/call-reminders).
export const MORNING_REMINDER_TIME = "08:00";
export const HOUR_REMINDER_MINUTES = 60;

export async function runCallReminders(now: Date = new Date()) {
  const results = { morning: 0, hour: 0, skipped: 0, errors: 0 };
  const calls = await prisma.callBooking.findMany({
    where: {
      status: "BOOKED",
      startTime: { gt: now, lt: new Date(now.getTime() + 26 * 3600_000) },
      order: { status: { in: ["IN_ESCROW", "COMPLETED"] } },
      OR: [{ hourReminderAt: null }, { morningReminderStudentAt: null }, { morningReminderMentorAt: null }],
    },
    include: {
      order: {
        include: {
          gig: { select: { title: true } },
          buyer: { select: { name: true, email: true, timeZone: true } },
          seller: { select: { name: true, email: true, timeZone: true } },
        },
      },
    },
    orderBy: { startTime: "asc" },
    take: 300,
  });

  for (const b of calls) {
    const o = b.order;
    const minsToStart = (b.startTime.getTime() - now.getTime()) / 60_000;
    const base = { gigTitle: o.gig.title, start: b.startTime, end: b.endTime, orderUrl: `${SITE_URL}/orders/${o.id}`, joinUrl: `${SITE_URL}/calls/${b.id}` };
    const people = [
      { key: "morningReminderStudentAt" as const, me: o.buyer, other: o.seller },
      { key: "morningReminderMentorAt" as const, me: o.seller, other: o.buyer },
    ];
    const email = (p: (typeof people)[number]): CallEmail => ({ ...base, timeZone: tzOrDefault(p.me.timeZone), otherName: p.other.name });

    // 1 hour before.
    if (!b.hourReminderAt && minsToStart <= HOUR_REMINDER_MINUTES) {
      // Claim first, so two overlapping runs can't both send.
      const claim = await prisma.callBooking.updateMany({ where: { id: b.id, hourReminderAt: null, status: "BOOKED" }, data: { hourReminderAt: now } });
      if (claim.count) {
        for (const p of people) {
          try {
            await sendCallReminderEmail(p.me.email, email(p), "hour");
            results.hour++;
          } catch (err) {
            console.error("Hour reminder failed", b.id, err);
            results.errors++;
          }
        }
      }
    }

    // Morning of, per person.
    for (const p of people) {
      if (b[p.key]) continue;
      const tz = tzOrDefault(p.me.timeZone);
      const callDay = dayInZone(b.startTime, tz);
      const eightAm = zonedToUtc(callDay, MORNING_REMINDER_TIME, tz);
      if (now < eightAm) continue; // not yet
      // Skip (but mark) when it would be pointless: the 1-hour reminder is
      // about to go, or the call was booked/moved after 8am that day.
      const pointless = minsToStart <= HOUR_REMINDER_MINUTES + 30 || (b.scheduledAt && b.scheduledAt > eightAm);
      const claim = await prisma.callBooking.updateMany({ where: { id: b.id, [p.key]: null, status: "BOOKED" }, data: { [p.key]: now } });
      if (!claim.count) continue;
      if (pointless) {
        results.skipped++;
        continue;
      }
      try {
        await sendCallReminderEmail(p.me.email, email(p), "morning");
        results.morning++;
      } catch (err) {
        console.error("Morning reminder failed", b.id, err);
        results.errors++;
      }
    }
  }
  return results;
}
