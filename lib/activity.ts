import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SOURCE_COOKIE, VISITOR_COOKIE, cleanVisitorId, cookieFrom, parseSourceCookie } from "@/lib/attribution";

// The private activity log (#86): visits, mentor profile views and
// browse searches, for Admin -> Insights. Only admins see it, and
// nothing here is ever shown to other users. Recording never breaks a
// page: every write is wrapped and failures are only logged.

export type ActivityKind = "VISIT" | "PROFILE_VIEW" | "SEARCH" | "SIGNUP";

// Repeat events from the same browser inside this window count once
// (a refresh, going back and forth between pages).
const DEDUPE_MINUTES: Record<ActivityKind, number> = { VISIT: 30, PROFILE_VIEW: 30, SEARCH: 10, SIGNUP: 0 };

// Old events are deleted by the daily cron after this many days.
export const ACTIVITY_KEEP_DAYS = 400;

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|vercel/i;
export function isBotUserAgent(ua: string | null | undefined) {
  return !ua || BOT_UA.test(ua);
}

export type ActivityInput = {
  kind: ActivityKind;
  visitorId?: string | null;
  userId?: string | null;
  mentorId?: string | null;
  query?: string | null;
  filters?: Record<string, string[]> | null;
  resultCount?: number | null;
  source?: string | null;
  path?: string | null;
};

// Same browser (or account), same thing, within the dedupe window.
async function isDuplicate(e: ActivityInput) {
  const minutes = DEDUPE_MINUTES[e.kind];
  if (!minutes || (!e.visitorId && !e.userId)) return false;
  const since = new Date(Date.now() - minutes * 60_000);
  const who: Prisma.ActivityEventWhereInput = e.visitorId ? { visitorId: e.visitorId } : { userId: e.userId };
  const where: Prisma.ActivityEventWhereInput = { ...who, kind: e.kind, createdAt: { gte: since } };
  if (e.kind === "PROFILE_VIEW") where.mentorId = e.mentorId ?? null;
  if (e.kind === "SEARCH") {
    where.query = e.query ?? null;
    where.filters = e.filters ? { equals: e.filters as Prisma.InputJsonValue } : undefined;
  }
  return !!(await prisma.activityEvent.findFirst({ where, select: { id: true } }));
}

export async function recordActivity(e: ActivityInput) {
  try {
    if (await isDuplicate(e)) return false;
    await prisma.activityEvent.create({
      data: {
        kind: e.kind,
        visitorId: e.visitorId || null,
        userId: e.userId || null,
        mentorId: e.mentorId || null,
        query: e.query || null,
        filters: e.filters && Object.keys(e.filters).length ? (e.filters as Prisma.InputJsonValue) : undefined,
        resultCount: typeof e.resultCount === "number" ? e.resultCount : null,
        source: e.source || null,
        path: e.path ? e.path.slice(0, 200) : null,
      },
    });
    return true;
  } catch (err) {
    console.error("Couldn't record activity:", err);
    return false;
  }
}

// The visitor id and first-visit source from a request's cookies.
export function attributionFromCookieHeader(header: string | null | undefined) {
  return {
    visitorId: cleanVisitorId(cookieFrom(header, VISITOR_COOKIE)),
    source: parseSourceCookie(cookieFrom(header, SOURCE_COOKIE)),
  };
}

// For a new account: { signupSource, signupDetail } to store on the user.
export function signupAttribution(header: string | null | undefined, fallback: string | null = null) {
  const { source } = attributionFromCookieHeader(header);
  return { signupSource: source?.source || fallback, signupDetail: source?.detail || null };
}

// Logs the signup itself, tying the browser's earlier visits to the account.
export async function recordSignup(userId: string, header: string | null | undefined, source: string | null) {
  const { visitorId } = attributionFromCookieHeader(header);
  await recordActivity({ kind: "SIGNUP", userId, visitorId, source });
  // Earlier anonymous events from this browser now belong to the account.
  if (visitorId) {
    await prisma.activityEvent
      .updateMany({ where: { visitorId, userId: null }, data: { userId } })
      .catch((err) => console.error("Couldn't link earlier activity:", err));
  }
}

export async function cleanupOldActivity(now = new Date()) {
  const cutoff = new Date(now.getTime() - ACTIVITY_KEEP_DAYS * 86400_000);
  const r = await prisma.activityEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return r.count;
}
