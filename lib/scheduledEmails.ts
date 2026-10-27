// Reminder emails that depend on time passing (ported from AdmitMD's
// lib/scheduledEmails.ts). Run once a day by /api/cron/emails (see
// vercel.json), and previewed in Admin -> Emails -> Outbox. Server only.
//
// Each reminder is an editable email in lib/emailTemplates.ts (the ones
// with `schedule`). Admins switch it on and set its timing in Admin ->
// Emails ("After 1 day, then 3 days"); the setting lives in the
// EmailSchedule table, and with no row the reminder is off.
//
// The rules every reminder follows:
//   - Each step goes out once: ScheduledEmailSent is unique on (email,
//     what it's about, step), and the row is written BEFORE sending, so two
//     runs at the same time can't both send it. If the send fails, the row
//     is removed again and the next run tries again.
//   - Nothing old is dug up: a step is only sent within a week of when it
//     was due (GRACE_HOURS). Switching a reminder on doesn't email everyone
//     who ever signed up, and a step missed while it was off is skipped.
//   - Never to: accounts removed by an admin, paused for a safety review,
//     students under 18 whose parent hasn't consented, or anyone who
//     pressed "Stop these reminders" (User.remindersOffAt).
//   - One bad record never stops the rest: each is tried on its own.
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EMAILS, blocks, parseTiming, type Values } from "@/lib/emailTemplates";
import { sendReminderEmail, SITE_URL } from "@/lib/email";
import { visibleMentorWhere } from "@/lib/mentor";
import { profileFieldsSelect, profileSections } from "@/lib/profileCompleteness";
import { payoutsReady } from "@/lib/stripeAccountStatus";

const HOUR = 3600_000;
// A step is still sent up to a week after it was due (a missed cron run,
// or the reminder was switched on a few days late), never later.
export const GRACE_HOURS = 7 * 24;
// The most reminder emails one cron run sends; the rest go the next day.
export const MAX_SENDS_PER_RUN = 150;
// The cron's time of day (UTC), matching /api/cron/emails in vercel.json.
export const CRON_HOUR_UTC = 15;
// A checkout reminder isn't sent again for the same student and mentor
// within this many days, even for a newer unfinished checkout.
const CHECKOUT_REPEAT_DAYS = 14;

export const REMINDER_KEYS = [
  "reminder_abandoned_checkout",
  "reminder_no_contact",
  "reminder_after_intro",
  "reminder_mentor_profile",
  "reminder_mentor_payouts",
] as const;
export type ReminderKey = (typeof REMINDER_KEYS)[number];

// ---- Settings (Admin -> Emails) ----

export type ReminderSetting = {
  key: ReminderKey;
  enabled: boolean;
  timing: string; // what the admin typed (or the standard timing)
  hours: number[]; // each step, in hours after the starting point
  standard: boolean; // true = no saved timing
};

export async function reminderSettings(): Promise<Record<ReminderKey, ReminderSetting>> {
  const rows = await prisma.emailSchedule.findMany({ where: { key: { in: [...REMINDER_KEYS] } } }).catch((err) => {
    console.error("Couldn't load reminder settings:", err);
    return [];
  });
  const out = {} as Record<ReminderKey, ReminderSetting>;
  for (const key of REMINDER_KEYS) {
    const def = EMAILS[key].schedule!;
    const row = rows.find((r) => r.key === key);
    let timing = row?.timing || def.timing;
    let parsed = parseTiming(timing);
    if (parsed.error) {
      // A saved timing that no longer passes the rules: use the standard one.
      console.error(`Saved timing for "${key}" isn't valid, using the standard timing:`, parsed.error);
      timing = def.timing;
      parsed = parseTiming(timing);
    }
    out[key] = { key, enabled: !!row?.enabled, timing, hours: parsed.hours, standard: !row || row.timing === def.timing };
  }
  return out;
}

// ---- "Stop these reminders" links ----
// Signed with NEXTAUTH_SECRET (like the waitlist removal links), so nobody
// can turn off someone else's reminders by guessing ids.
function secret() {
  return process.env.NEXTAUTH_SECRET || "mentorsmd";
}
export function remindersOffSig(userId: string) {
  return crypto.createHmac("sha256", secret()).update(`reminders-off:${userId}`).digest("hex").slice(0, 40);
}
export function checkRemindersOffSig(userId: unknown, sig: unknown) {
  if (typeof userId !== "string" || typeof sig !== "string" || !/^[a-z0-9]{10,40}$/i.test(userId) || !/^[a-f0-9]{40}$/.test(sig)) return false;
  const want = Buffer.from(remindersOffSig(userId));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
export const remindersOffUrl = (userId: string) => `${SITE_URL}/api/reminders/stop?u=${userId}&sig=${remindersOffSig(userId)}`;

// ---- Who's due ----

// One person a reminder could go to, and what starts its clock.
type Candidate = {
  refId: string; // what it's about: checkout, intro call, or the person's own id
  userId: string;
  aboutId: string | null; // the mentor it mentions, if any
  toEmail: string;
  name: string;
  about: string; // a short description for the Outbox
  start: Date; // the clock starts here
  values: Values; // the email's details (stopLink is added when sending)
};

export type PlannedReminder = Omit<Candidate, "values" | "start"> & {
  key: ReminderKey;
  step: number; // 0 = first email
  steps: number; // how many the timing has
  dueAt: Date;
  values: Values;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";
const isUnique = (err: unknown) => (err as { code?: string })?.code === "P2002";

// Students who can get reminders.
function studentWhere(): Prisma.UserWhereInput {
  return {
    role: "BUYER",
    removedByAdmin: false,
    profileStatus: { not: "REMOVED" },
    safetyHoldAt: null,
    remindersOffAt: null,
    AND: [
      // Under 18: only once a parent has consented.
      { OR: [{ minorStatus: null }, { minorStatus: "CONSENTED" }] },
      // Can log in: not an account a parent's gift created that the
      // student hasn't set up yet (lib/gifts.ts).
      { OR: [{ passwordHash: { not: null } }, { accounts: { some: {} } }] },
    ],
  };
}

// Mentors who can get reminders: shown on the site (not removed or paused
// by themselves or for a safety review).
function mentorWhere(now: Date): Prisma.UserWhereInput {
  return { AND: [visibleMentorWhere(now), { removedByAdmin: false, remindersOffAt: null }] };
}

// Mentors a student could still buy from.
async function listedMentors(ids: string[], now: Date) {
  if (!ids.length) return new Map<string, { id: string; name: string; acceptsMinors: boolean }>();
  const rows = await prisma.user.findMany({
    where: { AND: [{ id: { in: ids } }, visibleMentorWhere(now), { profileCompleteAt: { not: null } }] },
    select: { id: true, name: true, acceptsMinors: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function reachableStudents(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; name: string; email: string; minorStatus: string | null }>();
  const rows = await prisma.user.findMany({
    where: { AND: [{ id: { in: ids } }, studentWhere()] },
    select: { id: true, name: true, email: true, minorStatus: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

async function blocked(studentId: string, mentorId: string) {
  return (await prisma.block.count({ where: { OR: [{ blockerId: studentId, blockedId: mentorId }, { blockerId: mentorId, blockedId: studentId }] } })) > 0;
}

// 1. Checkout not finished: an order or "Add hours" top-up that was sent to
// Stripe and never paid. (Unpaid Stripe pages expire after an hour and the
// order / top-up is then CANCELLED, so both states count.) Per student and
// mentor, only their latest unfinished checkout gets reminders.
async function abandonedCheckouts(now: Date, from: Date, to: Date): Promise<Candidate[]> {
  // Not while the Stripe page could still be open.
  const latest = new Date(Math.min(to.getTime(), now.getTime() - 90 * 60_000));
  if (latest < from) return [];
  const [orders, topUps] = await Promise.all([
    prisma.order.findMany({
      where: { kind: { not: null }, paidAt: null, status: { in: ["PENDING_PAYMENT", "CANCELLED"] }, stripePaymentIntentId: { not: null }, createdAt: { gte: from, lte: latest } },
      select: { id: true, createdAt: true, buyerId: true, sellerId: true, kind: true, packageTitle: true },
    }),
    prisma.hourTopUp.findMany({
      where: { paidAt: null, status: { in: ["PENDING", "CANCELLED"] }, stripeSessionId: { not: null }, createdAt: { gte: from, lte: latest } },
      select: { id: true, createdAt: true, buyerId: true, order: { select: { id: true, sellerId: true, packageTitle: true, status: true, approvedAt: true, disputed: true } } },
    }),
  ]);

  type Checkout = { id: string; at: Date; studentId: string; mentorId: string; title: string; link: (mentorId: string) => string };
  const all: Checkout[] = [
    ...orders.map((o) => ({
      id: o.id,
      at: o.createdAt,
      studentId: o.buyerId,
      mentorId: o.sellerId,
      // "1-hour call with Priya" -> "1-hour call" (the email names the mentor).
      title: (o.kind === "PAY_PER_CALL" ? (o.packageTitle || "").replace(/ with .*$/, "") : o.packageTitle) || "your package",
      // The Stripe page has expired, so they start again from the profile.
      link: (mentorId: string) => `${SITE_URL}/mentors/${mentorId}`,
    })),
    // Top-ups only while the package is still going.
    ...topUps
      .filter((t) => t.order.status === "IN_ESCROW" && !t.order.approvedAt && !t.order.disputed)
      .map((t) => ({
        id: t.id,
        at: t.createdAt,
        studentId: t.buyerId,
        mentorId: t.order.sellerId,
        title: `extra hours for ${t.order.packageTitle || "your package"}`,
        link: () => `${SITE_URL}/orders/${t.order.id}`,
      })),
  ];
  const byPair = new Map<string, Checkout>();
  for (const c of all) {
    const k = `${c.studentId}:${c.mentorId}`;
    if (!byPair.get(k) || byPair.get(k)!.at < c.at) byPair.set(k, c);
  }
  const pairs = Array.from(byPair.values());
  const [students, mentors] = await Promise.all([
    reachableStudents(Array.from(new Set(pairs.map((p) => p.studentId)))),
    listedMentors(Array.from(new Set(pairs.map((p) => p.mentorId))), now),
  ]);

  const out: Candidate[] = [];
  for (const c of pairs) {
    try {
      const student = students.get(c.studentId);
      const mentor = mentors.get(c.mentorId);
      if (!student || !mentor) continue;
      if (student.minorStatus && !mentor.acceptsMinors) continue;
      // Bought anything from this mentor since (an order or more hours).
      const [paidOrders, paidTopUps] = await Promise.all([
        prisma.order.count({ where: { buyerId: c.studentId, sellerId: c.mentorId, OR: [{ paidAt: { gt: c.at } }, { createdAt: { gt: c.at }, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } }] } }),
        prisma.hourTopUp.count({ where: { buyerId: c.studentId, paidAt: { gt: c.at }, order: { sellerId: c.mentorId } } }),
      ]);
      if (paidOrders || paidTopUps) continue;
      if (await blocked(c.studentId, c.mentorId)) continue;
      out.push({
        refId: c.id,
        userId: c.studentId,
        aboutId: c.mentorId,
        toEmail: student.email,
        name: student.name,
        about: `${c.title} with ${mentor.name}`,
        start: c.at,
        values: { firstName: first(student.name), mentorName: mentor.name, packageTitle: c.title, checkoutLink: c.link(c.mentorId) },
      });
    } catch (err) {
      console.error("[reminders] checkout skipped:", c.id, err);
    }
  }
  return out;
}

// 2. Signed up but hasn't contacted anyone: a student with a confirmed
// email and no messages sent, intro calls or orders (paid or not).
async function noContactStudents(now: Date, from: Date, to: Date): Promise<Candidate[]> {
  const rows = await prisma.user.findMany({
    where: {
      AND: [
        studentWhere(),
        { emailVerified: { not: null }, createdAt: { gte: from, lte: to }, messages: { none: {} }, buyerOrders: { none: {} }, introCallsAsStudent: { none: {} } },
      ],
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  return rows.map((u) => ({
    refId: u.id,
    userId: u.id,
    aboutId: null,
    toEmail: u.email,
    name: u.name,
    about: "Signed up, no mentor contacted",
    start: u.createdAt,
    values: { firstName: first(u.name), mentorsLink: `${SITE_URL}/mentors` },
  }));
}

// 3. Intro call held, nothing bought: the student's free intro call with a
// mentor was held (lib/callOutcomes.ts), and they haven't bought from that
// mentor or started a checkout with them since.
async function introNoPurchase(now: Date, from: Date, to: Date): Promise<Candidate[]> {
  const calls = await prisma.callBooking.findMany({
    where: { kind: "INTRO", outcome: "HELD", status: { not: "CANCELLED" }, endTime: { gte: from, lte: to }, studentId: { not: null }, mentorId: { not: null } },
    select: { id: true, endTime: true, studentId: true, mentorId: true },
  });
  const [students, mentors] = await Promise.all([
    reachableStudents(Array.from(new Set(calls.map((c) => c.studentId!)))),
    listedMentors(Array.from(new Set(calls.map((c) => c.mentorId!))), now),
  ]);
  const out: Candidate[] = [];
  for (const c of calls) {
    try {
      const student = students.get(c.studentId!);
      const mentor = mentors.get(c.mentorId!);
      if (!student || !mentor) continue;
      if (student.minorStatus && !mentor.acceptsMinors) continue;
      // Bought from them (ever), or started a checkout after the call (the
      // checkout reminder covers that one).
      const orders = await prisma.order.count({
        where: { buyerId: student.id, sellerId: mentor.id, OR: [{ paidAt: { not: null } }, { status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] } }, { createdAt: { gt: c.endTime } }] },
      });
      if (orders) continue;
      if (await blocked(student.id, mentor.id)) continue;
      out.push({
        refId: c.id,
        userId: student.id,
        aboutId: mentor.id,
        toEmail: student.email,
        name: student.name,
        about: `Intro call with ${mentor.name}`,
        start: c.endTime,
        values: { firstName: first(student.name), mentorName: mentor.name, mentorLink: `${SITE_URL}/mentors/${mentor.id}` },
      });
    } catch (err) {
      console.error("[reminders] intro call skipped:", c.id, err);
    }
  }
  return out;
}

// 4. Mentor profile not finished: hidden from Browse until every section
// of lib/profileCompleteness.ts is filled in.
async function mentorProfileIncomplete(now: Date, from: Date, to: Date): Promise<Candidate[]> {
  const rows = await prisma.user.findMany({
    where: { AND: [mentorWhere(now), { profileCompleteAt: null, createdAt: { gte: from, lte: to } }] },
    select: { ...profileFieldsSelect, id: true, name: true, email: true, createdAt: true },
  });
  const out: Candidate[] = [];
  for (const u of rows) {
    const missing = profileSections(u).filter((s) => !s.done);
    if (!missing.length) continue; // finished; profileCompleteAt just hasn't caught up
    out.push({
      refId: u.id,
      userId: u.id,
      aboutId: null,
      toEmail: u.email,
      name: u.name,
      about: `${missing.length} section${missing.length === 1 ? "" : "s"} left: ${missing.map((m) => m.label).join(", ")}`,
      start: u.createdAt,
      values: { firstName: first(u.name), missingList: blocks.missing(missing.map((m) => ({ label: m.label, hint: m.hint }))), profileLink: `${SITE_URL}/dashboard/profile` },
    });
  }
  return out;
}

// 5. Payouts not connected: the profile is finished (so students can find
// them) but Stripe says their account can't be paid yet, so nobody can buy.
async function mentorPayoutsMissing(now: Date, from: Date, to: Date): Promise<Candidate[]> {
  const rows = await prisma.user.findMany({
    where: { AND: [mentorWhere(now), { profileCompleteAt: { not: null, gte: from, lte: to } }] },
    select: { id: true, name: true, email: true, profileCompleteAt: true, stripeAccountId: true },
  });
  const out: Candidate[] = [];
  for (const u of rows) {
    // Asks Stripe; a failed lookup counts as not ready, like checkout does.
    if (u.stripeAccountId && (await payoutsReady(u.stripeAccountId))) continue;
    out.push({
      refId: u.id,
      userId: u.id,
      aboutId: null,
      toEmail: u.email,
      name: u.name,
      about: u.stripeAccountId ? "Started Stripe setup, not finished" : "Hasn't started Stripe setup",
      start: u.profileCompleteAt!,
      values: { firstName: first(u.name), payoutsLink: `${SITE_URL}/dashboard/payouts` },
    });
  }
  return out;
}

const FINDERS: Record<ReminderKey, (now: Date, from: Date, to: Date) => Promise<Candidate[]>> = {
  reminder_abandoned_checkout: abandonedCheckouts,
  reminder_no_contact: noContactStudents,
  reminder_after_intro: introNoPurchase,
  reminder_mentor_profile: mentorProfileIncomplete,
  reminder_mentor_payouts: mentorPayoutsMissing,
};

// Which step is next for one record, and when it's due. A step that's
// already due is sent now; if several are due (a missed run), only the
// latest. Steps already sent, and steps more than GRACE_HOURS overdue, are
// skipped. Null = nothing left to send.
export function nextStep(start: Date, hours: number[], sentSteps: number[], now: Date): { step: number; dueAt: Date } | null {
  const after = sentSteps.length ? Math.max(...sentSteps) : -1;
  const open = hours
    .map((h, step) => ({ step, dueAt: new Date(start.getTime() + h * HOUR) }))
    .filter((s) => s.step > after && s.dueAt.getTime() + GRACE_HOURS * HOUR > now.getTime());
  if (!open.length) return null;
  const due = open.filter((s) => s.dueAt <= now);
  return due.length ? due[due.length - 1] : open[0];
}

// Everything due by `now + horizonHours`, for one reminder.
async function planOne(setting: ReminderSetting, now: Date, horizonHours: number): Promise<PlannedReminder[]> {
  const { key, hours } = setting;
  // Starting points that could have a step due in [now - grace, now + horizon].
  const from = new Date(now.getTime() - (Math.max(...hours) + GRACE_HOURS) * HOUR);
  const to = new Date(now.getTime() + (horizonHours - Math.min(...hours)) * HOUR);
  if (to < from) return [];
  const candidates = await FINDERS[key](now, from, to);
  if (!candidates.length) return [];
  const sent = await prisma.scheduledEmailSent.findMany({
    where: { key, refId: { in: candidates.map((c) => c.refId) } },
    select: { refId: true, step: true },
  });
  // Checkout reminders: who already got one for this mentor recently.
  const recent =
    key === "reminder_abandoned_checkout"
      ? await prisma.scheduledEmailSent.findMany({
          where: { key, userId: { in: candidates.map((c) => c.userId) }, sentAt: { gte: new Date(now.getTime() - CHECKOUT_REPEAT_DAYS * 24 * HOUR) } },
          select: { userId: true, aboutId: true, refId: true },
        })
      : [];
  const horizon = new Date(now.getTime() + horizonHours * HOUR);
  const out: PlannedReminder[] = [];
  for (const c of candidates) {
    const mine = sent.filter((s) => s.refId === c.refId).map((s) => s.step);
    if (!mine.length && recent.some((r) => r.userId === c.userId && r.aboutId === c.aboutId && r.refId !== c.refId)) continue;
    const next = nextStep(c.start, hours, mine, now);
    if (!next || next.dueAt > horizon) continue;
    const { start: _start, ...rest } = c;
    out.push({ ...rest, key, step: next.step, steps: hours.length, dueAt: next.dueAt });
  }
  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export type ReminderPlan = { setting: ReminderSetting; planned: PlannedReminder[]; error: string | null };

// Every reminder (on or off), with who's due by now + horizonHours.
export async function planReminders(now = new Date(), horizonHours = 0): Promise<ReminderPlan[]> {
  const settings = await reminderSettings();
  const out: ReminderPlan[] = [];
  for (const key of REMINDER_KEYS) {
    try {
      out.push({ setting: settings[key], planned: await planOne(settings[key], now, horizonHours), error: null });
    } catch (err) {
      console.error(`[reminders] couldn't work out "${key}":`, err);
      out.push({ setting: settings[key], planned: [], error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

// When the daily cron runs next (vercel.json: every day at 15:00 UTC).
export function nextCronRun(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_HOUR_UTC));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// ---- Sending (the daily cron, or "Run now" in Admin -> Outbox) ----

export async function runScheduledEmails(now = new Date()) {
  const plans = await planReminders(now, 0);
  const result: Record<string, { sent: number; failed: number; skipped?: string }> = {};
  let budget = MAX_SENDS_PER_RUN;
  for (const { setting, planned, error } of plans) {
    const r = (result[setting.key] = { sent: 0, failed: 0 } as { sent: number; failed: number; skipped?: string });
    if (error) r.skipped = error;
    if (!setting.enabled) {
      r.skipped = "off";
      continue;
    }
    for (const p of planned) {
      if (p.dueAt > now) continue;
      if (budget <= 0) {
        r.skipped = `Stopped at ${MAX_SENDS_PER_RUN} emails this run; the rest go next time.`;
        break;
      }
      try {
        // Claim the step first, so it can never go out twice.
        const claim = await prisma.scheduledEmailSent
          .create({ data: { key: p.key, refId: p.refId, step: p.step, userId: p.userId, aboutId: p.aboutId, toEmail: p.toEmail } })
          .catch((err) => {
            if (isUnique(err)) return null;
            throw err;
          });
        if (!claim) continue;
        budget--;
        try {
          await sendReminderEmail(p.key, p.toEmail, { ...p.values, stopLink: remindersOffUrl(p.userId) });
          r.sent++;
        } catch (err) {
          // Not sent: let the next run try again.
          await prisma.scheduledEmailSent.delete({ where: { id: claim.id } }).catch(() => {});
          throw err;
        }
      } catch (err) {
        r.failed++;
        console.error(`[reminders] "${p.key}" to ${p.userId} failed:`, err);
      }
    }
  }
  return result;
}
