import { prisma } from "@/lib/prisma";
import { hasAvailability } from "@/lib/schedule";
import { callSummary, CALL_HOLD_HOURS, CALL_REMINDER_EVERY_DAYS } from "@/lib/calls";
import {
  sendBookCallReminderEmail,
  sendCallForfeitedEmail,
  sendCallHoldEmail,
  SITE_URL,
} from "@/lib/email";

// The unbooked-call rule, run once a day from the overdue-reminders cron.
// (Recommended version - still an open question, see the open-questions doc.)
//
//   1. While a call is unbooked, remind the student every few days.
//   2. When the due date passes with a call still unbooked, pause the
//      order ("on hold") and email both sides. The mentor can extend the
//      due date, message the student, or contact us. The student gets
//      48 hours to book or say "I don't need the call".
//   3. After those 48 hours: if the mentor had availability set (so the
//      student could have booked a slot), the call is forfeited and the
//      mentor can complete the order. Otherwise it stays on hold for an
//      admin to decide.
const BATCH = 100;

const include = {
  gig: true,
  callBookings: true,
  buyer: { select: { email: true } },
  seller: { select: { email: true, weeklyHours: true } },
} as const;

export async function runCallRules(now: Date = new Date()) {
  const results = { reminded: 0, held: 0, forfeited: 0, errors: 0 };
  const base = {
    status: "IN_ESCROW" as const,
    disputed: false,
    callWaivedAt: null,
    callForfeitedAt: null,
    gig: { callsIncluded: { gt: 0 } },
    // Orders with a call already booked don't need nudging.
    callBookings: { none: { status: "BOOKED" as const, endTime: { gt: now } } },
  };

  // 1. Reminders (not yet on hold).
  const remindBefore = new Date(now.getTime() - CALL_REMINDER_EVERY_DAYS * 24 * 3600_000);
  const toRemind = await prisma.order.findMany({
    where: {
      ...base,
      callHoldAt: null,
      createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) },
      OR: [{ callReminderSentAt: null }, { callReminderSentAt: { lt: remindBefore } }],
    },
    include,
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  for (const o of toRemind) {
    if (callSummary(o, now).toBook === 0) continue;
    try {
      await sendBookCallReminderEmail(o.buyer.email, o.gig.title, o.dueDate, `${SITE_URL}/orders/${o.id}`);
      results.reminded++;
    } catch (e) {
      console.error(`Call reminder failed for ${o.id}`, e);
      results.errors++;
    }
    await prisma.order.update({ where: { id: o.id }, data: { callReminderSentAt: now } }).catch(() => {});
  }

  // 2. Due date passed, call still unbooked -> hold.
  const toHold = await prisma.order.findMany({
    where: { ...base, callHoldAt: null, dueDate: { lt: now } },
    include,
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  for (const o of toHold) {
    if (callSummary(o, now).toBook === 0) continue;
    await prisma.order.update({ where: { id: o.id }, data: { callHoldAt: now } });
    results.held++;
    const url = `${SITE_URL}/orders/${o.id}`;
    await sendCallHoldEmail(o.buyer.email, o.gig.title, url, true).catch((e) => console.error("hold email", e));
    await sendCallHoldEmail(o.seller.email, o.gig.title, url, false).catch((e) => console.error("hold email", e));
  }

  // 3. Hold expired -> forfeit (only if the mentor offered a way to book).
  const toForfeit = await prisma.order.findMany({
    where: { ...base, callHoldAt: { lt: new Date(now.getTime() - CALL_HOLD_HOURS * 3600_000) } },
    include,
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  for (const o of toForfeit) {
    if (callSummary(o, now).toBook === 0) continue;
    if (!hasAvailability(o.seller.weeklyHours)) continue; // stays on hold; admin decides
    await prisma.order.update({ where: { id: o.id }, data: { callForfeitedAt: now } });
    results.forfeited++;
    const url = `${SITE_URL}/orders/${o.id}`;
    await sendCallForfeitedEmail(o.buyer.email, o.gig.title, url).catch((e) => console.error("forfeit email", e));
    await sendCallForfeitedEmail(o.seller.email, o.gig.title, url).catch((e) => console.error("forfeit email", e));
  }

  return results;
}
