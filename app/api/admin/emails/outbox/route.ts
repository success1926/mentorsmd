import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/adminLog";
import { EMAILS, waitLabel } from "@/lib/emailTemplates";
import { REMINDER_KEYS, nextCronRun, planReminders, runScheduledEmails, type PlannedReminder } from "@/lib/scheduledEmails";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// How far ahead "Coming up" looks, and the most rows shown per list.
const AHEAD_DAYS = 7;
const SHOW = 100;

const row = (p: PlannedReminder) => ({
  userId: p.userId,
  name: p.name,
  toEmail: p.toEmail,
  about: p.about,
  step: p.step,
  steps: p.steps,
  dueAt: p.dueAt,
});

// Admin -> Emails -> Outbox: for each reminder email, who gets it on the
// next cron run, who's coming up in the next week, and what was sent
// recently. Read-only.
export async function GET() {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const now = new Date();
  const nextRun = nextCronRun(now);
  const plans = await planReminders(now, AHEAD_DAYS * 24);
  const sent = await prisma.scheduledEmailSent.findMany({ orderBy: { sentAt: "desc" }, take: 50 });
  const people = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(sent.flatMap((s) => [s.userId, s.aboutId].filter((x): x is string => !!x)))) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  return NextResponse.json(
    {
      now,
      nextRun,
      aheadDays: AHEAD_DAYS,
      canRun: admin.adminRole === "OWNER",
      reminders: plans.map(({ setting, planned, error }) => {
        const next = planned.filter((p) => p.dueAt <= nextRun);
        const later = planned.filter((p) => p.dueAt > nextRun);
        return {
          key: setting.key,
          name: EMAILS[setting.key].name,
          group: EMAILS[setting.key].group,
          enabled: setting.enabled,
          timing: setting.timing,
          steps: setting.hours.map(waitLabel),
          error,
          nextCount: next.length,
          next: next.slice(0, SHOW).map(row),
          laterCount: later.length,
          later: later.slice(0, SHOW).map(row),
        };
      }),
      recent: sent.map((s) => ({
        id: s.id,
        key: s.key,
        name: EMAILS[s.key]?.name ?? s.key,
        step: s.step,
        toEmail: s.toEmail,
        userId: s.userId,
        userName: nameOf.get(s.userId) ?? null,
        aboutName: s.aboutId ? nameOf.get(s.aboutId) ?? null : null,
        sentAt: s.sentAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// "Run now" (Owners only): the same run as the daily cron. Safe to press
// twice: a reminder step that went out is never sent again, and reminders
// that are off send nothing.
export async function POST() {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only the Owner can run the reminders by hand." }, { status: 403 });
  const result = await runScheduledEmails(new Date());
  const total = Object.values(result).reduce((n, r) => n + r.sent, 0);
  await logAdminAction({ adminId: admin.id, action: "REMINDERS_RUN", summary: `Ran the reminder emails by hand (${total} sent)`, details: { result, keys: [...REMINDER_KEYS] } });
  return NextResponse.json({ ok: true, result, total });
}
