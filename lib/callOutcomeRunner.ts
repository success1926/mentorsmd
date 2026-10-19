// Decides what happened at each call once it's over (held, student
// no-show, mentor no-show, nobody joined), from Daily's attendance log,
// and tells both people. The rules themselves are in lib/callOutcomes.ts.
// Runs every 15 minutes from the call-reminders cron. Server only.
//
// Safe to run any number of times: each call is claimed (outcome set)
// before anything is sent, so two overlapping runs can't both email.
import { prisma } from "@/lib/prisma";
import { createFlag } from "@/lib/flags";
import { CallEmail, CallOutcomeEmailKey, SITE_URL, sendCallOutcomeEmail } from "@/lib/email";
import { tzOrDefault } from "@/lib/tz";
import { syncCallHourEntry } from "@/lib/hourLog";
import { CallOutcome, DECIDE_AFTER_END_MINUTES, DECIDE_WITHIN_HOURS, FREES_THE_CALL, NEEDS_ADMIN, classifyCall } from "@/lib/callOutcomes";

const BATCH = 100;

const bookingInclude = {
  attendance: { select: { userId: true, joinedAt: true, leftAt: true } },
  order: {
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      conversationId: true,
      packageTitle: true,
      gig: { select: { title: true } },
      buyer: { select: { name: true, email: true, timeZone: true } },
      seller: { select: { name: true, email: true, timeZone: true } },
    },
  },
} as const;

type BookingForOutcome = {
  id: string;
  startTime: Date;
  endTime: Date;
  order: {
    id: string;
    sellerId: string;
    conversationId: string | null;
    packageTitle: string | null;
    gig: { title: string };
    buyer: { name: string; email: string; timeZone: string | null };
    seller: { name: string; email: string; timeZone: string | null };
  };
};

export async function runCallOutcomes(now: Date = new Date()) {
  const results = { held: 0, studentNoShow: 0, mentorNoShow: 0, needsAdmin: 0, errors: 0 };
  // Attendance is only recorded once the Daily webhook is connected.
  // Without it, a call with no attendance counts as held (the old rule).
  const webhookOn = !!process.env.DAILY_WEBHOOK_SECRET;
  const calls = await prisma.callBooking.findMany({
    where: {
      status: "BOOKED",
      outcome: null,
      endTime: {
        lt: new Date(now.getTime() - DECIDE_AFTER_END_MINUTES * 60_000),
        gt: new Date(now.getTime() - DECIDE_WITHIN_HOURS * 3600_000),
      },
      order: { status: { in: ["IN_ESCROW", "COMPLETED"] } },
    },
    include: bookingInclude,
    orderBy: { endTime: "asc" },
    take: BATCH,
  });

  for (const b of calls) {
    try {
      const outcome = classifyCall({
        start: b.startTime,
        end: b.endTime,
        studentId: b.order.buyerId,
        mentorId: b.order.sellerId,
        attendance: b.attendance,
        webhookOn,
      });
      const claim = await prisma.callBooking.updateMany({
        where: { id: b.id, outcome: null, status: "BOOKED" },
        data: { outcome, outcomeAt: now, outcomeById: null },
      });
      if (!claim.count) continue;
      await afterOutcome(b, outcome);
      if (outcome === "HELD") results.held++;
      else if (outcome === "STUDENT_NO_SHOW") results.studentNoShow++;
      else if (outcome === "MENTOR_NO_SHOW") results.mentorNoShow++;
      else results.needsAdmin++;
    } catch (err) {
      console.error("Call outcome failed", b.id, err);
      results.errors++;
    }
  }
  await runIntroCallOutcomes(now, webhookOn, results);
  return results;
}

// Free intro calls (no order, redesign Oct 2026) get an outcome on the
// same rules, but no emails or flags: a held intro call unlocks buying
// (lib/unlock.ts). If the mentor didn't show up, the student can book
// another one (the one-per-pair key is cleared).
async function runIntroCallOutcomes(now: Date, webhookOn: boolean, results: { held: number; studentNoShow: number; mentorNoShow: number; needsAdmin: number; errors: number }) {
  const calls = await prisma.callBooking.findMany({
    where: {
      kind: "INTRO",
      status: "BOOKED",
      outcome: null,
      endTime: {
        lt: new Date(now.getTime() - DECIDE_AFTER_END_MINUTES * 60_000),
        gt: new Date(now.getTime() - DECIDE_WITHIN_HOURS * 3600_000),
      },
    },
    include: { attendance: { select: { userId: true, joinedAt: true, leftAt: true } } },
    orderBy: { endTime: "asc" },
    take: BATCH,
  });
  for (const b of calls) {
    if (!b.studentId || !b.mentorId) continue;
    try {
      const outcome = classifyCall({ start: b.startTime, end: b.endTime, studentId: b.studentId, mentorId: b.mentorId, attendance: b.attendance, webhookOn });
      const claim = await prisma.callBooking.updateMany({
        where: { id: b.id, outcome: null, status: "BOOKED" },
        data: { outcome, outcomeAt: now, outcomeById: null, ...(FREES_THE_CALL.includes(outcome) ? { introKey: null } : {}) },
      });
      if (!claim.count) continue;
      if (outcome === "HELD") results.held++;
      else if (outcome === "STUDENT_NO_SHOW") results.studentNoShow++;
      else if (outcome === "MENTOR_NO_SHOW") results.mentorNoShow++;
      else results.needsAdmin++;
    } catch (err) {
      console.error("Intro call outcome failed", b.id, err);
      results.errors++;
    }
  }
}

// Loads one call in the shape afterOutcome needs (for admin changes).
export function bookingForOutcome(id: string) {
  return prisma.callBooking.findUnique({ where: { id }, include: bookingInclude });
}

function callEmail(b: BookingForOutcome, to: "student" | "mentor"): CallEmail {
  const me = to === "student" ? b.order.buyer : b.order.seller;
  const other = to === "student" ? b.order.seller : b.order.buyer;
  return {
    gigTitle: b.order.packageTitle || b.order.gig.title,
    start: b.startTime,
    end: b.endTime,
    timeZone: tzOrDefault(me.timeZone),
    otherName: other.name,
    orderUrl: `${SITE_URL}/orders/${b.order.id}`,
    joinUrl: `${SITE_URL}/calls/${b.id}`,
  };
}

async function email(b: BookingForOutcome, to: "student" | "mentor", key: CallOutcomeEmailKey, secondMissed = "") {
  const address = to === "student" ? b.order.buyer.email : b.order.seller.email;
  await sendCallOutcomeEmail(address, key, callEmail(b, to), secondMissed).catch((e) => console.error(`Call outcome email (${key}) failed`, e));
}

const when = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16) + " UTC";

// Emails and flags for an outcome that was just set, automatically or by
// an admin. Held and free rebooks send nothing (a held call is the normal
// case; a free rebook is an admin's decision they'll explain themselves).
export async function afterOutcome(b: BookingForOutcome, outcome: CallOutcome) {
  // Hours orders: a held call (or a student no-show) uses its booked time
  // in the hours log; a mentor no-show or free rebook doesn't.
  await syncCallHourEntry(b.id).catch((err) => console.error("Hours log for a call failed", b.id, err));
  if (outcome === "STUDENT_NO_SHOW") {
    await email(b, "student", "call_student_no_show_student");
    await email(b, "mentor", "call_student_no_show_mentor");
    return;
  }

  if (outcome === "MENTOR_NO_SHOW") {
    const missed = await prisma.callBooking.count({ where: { orderId: b.order.id, outcome: "MENTOR_NO_SHOW", status: { not: "CANCELLED" } } });
    const second = missed >= 2;
    await email(b, "student", "call_mentor_no_show_student", second ? "This is the second call your mentor has missed on this order" : "");
    await email(b, "mentor", "call_mentor_no_show_mentor", second ? "This is the second call missed on this order" : "");
    await createFlag({
      kind: "CALL",
      source: "SYSTEM",
      // The second one is high severity (instant email to admins): the
      // student can now open a dispute for a full refund.
      severity: second ? 3 : 1,
      reason: second
        ? "Mentor missed a second call on this order: the student can open a dispute (full refund expected)"
        : "Mentor didn't join a call (the student gets a free rebook)",
      details: `Call on ${when(b.startTime)} for "${b.order.packageTitle || b.order.gig.title}". Missed calls on this order: ${missed}.`,
      subjectUserId: b.order.sellerId,
      orderId: b.order.id,
      conversationId: b.order.conversationId,
      dedupeKey: second ? `call-mentor-no-show-2:${b.order.id}` : `call-mentor-no-show:${b.id}`,
      dedupeDays: 365,
    });
    return;
  }

  if (NEEDS_ADMIN.includes(outcome)) {
    await email(b, "student", "call_nobody_joined");
    await email(b, "mentor", "call_nobody_joined");
    await createFlag({
      kind: "CALL",
      source: "SYSTEM",
      severity: 2,
      reason:
        outcome === "NOBODY_JOINED"
          ? "Nobody joined a call: decide whether it counts (Admin -> Calls & recordings)"
          : "Unclear what happened at a call (both late or very short): decide whether it counts",
      details: `Call on ${when(b.startTime)} for "${b.order.packageTitle || b.order.gig.title}". Choose an outcome in Admin -> Calls & recordings.`,
      // Not about anyone yet: nobody is to blame until an admin decides.
      subjectUserId: null,
      orderId: b.order.id,
      conversationId: b.order.conversationId,
      dedupeKey: `call-outcome:${b.id}`,
      dedupeDays: 365,
    });
  }
}
