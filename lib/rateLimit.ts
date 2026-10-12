import { prisma } from "@/lib/prisma";
import { warnOnce } from "@/lib/warnOnce";
import { fetchWithTimeout } from "@/lib/request";

// Fixed-window rate limits ("at most N per window").
//
// With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set, counters
// live in Upstash Redis (fast, shared by every server instance). Without
// them, counters fall back to the RateLimitBucket table in our own
// database, which works the same way, just with one extra query.
//
// Limits are a safety net, so if the counter store itself fails the
// request is allowed rather than locking everyone out.

export type Limit = { name: string; max: number; windowSec: number };

// Every limit in one place, so they're easy to tune.
export const RATE_LIMITS = {
  signupPerIpHour: { name: "signup-ip-h", max: 5, windowSec: 3600 },
  signupPerIpDay: { name: "signup-ip-d", max: 20, windowSec: 86400 },
  loginPerIp: { name: "login-ip", max: 30, windowSec: 900 },
  // Wrong passwords for one account from one IP. Locks only that IP out
  // of that account, so a stranger can't lock the real owner out.
  loginFailPerAccountIp: { name: "login-fail", max: 5, windowSec: 900 },
  forgotPerIp: { name: "forgot-ip", max: 10, windowSec: 3600 },
  messagesPerMinute: { name: "msg-m", max: 15, windowSec: 60 },
  messagesPerDay: { name: "msg-d", max: 400, windowSec: 86400 },
  uploadsPerHour: { name: "upload-h", max: 40, windowSec: 3600 },
  applicationsPerIpHour: { name: "apply-ip", max: 5, windowSec: 3600 },
  reportsPerHour: { name: "report-h", max: 10, windowSec: 3600 },
  verifyEmailPerHour: { name: "verify-h", max: 3, windowSec: 3600 },
  // Phase 5
  parentConsentPerDay: { name: "parent-consent-d", max: 5, windowSec: 86400 },
  parentPagePerIpHour: { name: "parent-page-ip", max: 60, windowSec: 3600 },
  adminCodePerHour: { name: "admin-code-h", max: 5, windowSec: 3600 },
  admin2faTries: { name: "admin-2fa", max: 10, windowSec: 900 },
  teamInvitePerHour: { name: "team-invite-h", max: 20, windowSec: 3600 },
  // Phase 6
  invitePrefillPerIpHour: { name: "invite-prefill-ip", max: 30, windowSec: 3600 },
  trackPerIpHour: { name: "track-ip", max: 300, windowSec: 3600 },
} satisfies Record<string, Limit>;

function upstash() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    warnOnce("upstash", "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set - rate limits use the database instead.");
    return null;
  }
  return { url: url.replace(/\/$/, ""), token };
}

function bucketKey(limit: Limit, id: string, now = Date.now()) {
  const window = Math.floor(now / 1000 / limit.windowSec);
  return { key: `rl:${limit.name}:${id}:${window}`, expiresAt: new Date((window + 1) * limit.windowSec * 1000) };
}

async function redis(cmds: (string | number)[][]): Promise<any[] | null> {
  const r = upstash();
  if (!r) return null;
  const res = await fetchWithTimeout(`${r.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${r.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  }, 2500);
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const data = (await res.json()) as { result?: any; error?: string }[];
  return data.map((d) => d.result);
}

// Counts one attempt. Returns ok: false once the limit is passed.
export async function rateLimit(limit: Limit, id: string): Promise<{ ok: boolean; count: number; retryAfterSec: number }> {
  const { key, expiresAt } = bucketKey(limit, id);
  const retryAfterSec = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
  try {
    let count: number;
    const r = await redis([["INCR", key], ["EXPIRE", key, limit.windowSec + 60]]);
    if (r) {
      count = Number(r[0]) || 0;
    } else {
      const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
        RETURNING "count"`;
      count = Number(rows[0]?.count) || 0;
    }
    return { ok: count <= limit.max, count, retryAfterSec };
  } catch (err) {
    console.error(`Rate limit check failed (${limit.name}) - allowing the request:`, err);
    return { ok: true, count: 0, retryAfterSec: 0 };
  }
}

// Reads a counter without adding to it.
export async function rateLimitCount(limit: Limit, id: string): Promise<number> {
  const { key } = bucketKey(limit, id);
  try {
    const r = await redis([["GET", key]]);
    if (r) return Number(r[0]) || 0;
    const row = await prisma.rateLimitBucket.findUnique({ where: { key } });
    return row?.count ?? 0;
  } catch (err) {
    console.error(`Rate limit read failed (${limit.name}):`, err);
    return 0;
  }
}

export async function clearRateLimit(limit: Limit, id: string) {
  const { key } = bucketKey(limit, id);
  try {
    const r = await redis([["DEL", key]]);
    if (!r) await prisma.rateLimitBucket.deleteMany({ where: { key } });
  } catch (err) {
    console.error(`Rate limit reset failed (${limit.name}):`, err);
  }
}

// Housekeeping for the database fallback (called by the daily cron).
export async function cleanupRateLimits() {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

export function tooMany(retryAfterSec: number, message = "Too many attempts. Please wait a bit and try again.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSec) },
  });
}
