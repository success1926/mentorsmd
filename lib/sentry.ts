import crypto from "crypto";
import { warnOnce } from "@/lib/warnOnce";
import { fetchWithTimeout, runAfterResponse } from "@/lib/request";

// Tiny error reporter for Sentry (https://sentry.io), using Sentry's
// envelope HTTP endpoint directly instead of the @sentry/nextjs SDK (no
// extra dependency, nothing to change in the build).
//
// Env: SENTRY_DSN (Sentry -> Project settings -> Client Keys (DSN)).
// Optional SENTRY_ENVIRONMENT (defaults to VERCEL_ENV or NODE_ENV).
// Off when SENTRY_DSN isn't set.
//
// What gets reported:
//  - every console.error on the server (hooked up in instrumentation.ts),
//    which covers the existing error logging all over the app
//  - reportError() calls, used where a person must act, e.g. the
//    "[NEEDS MANUAL CHECK]" payout lines (sent as level "fatal")

type Level = "fatal" | "error" | "warning" | "info";

function parseDsn(dsn: string | undefined) {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+|\/+$/g, "").split("/").pop();
    if (!u.username || !projectId) return null;
    const pathPrefix = u.pathname.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
    return {
      key: u.username,
      url: `${u.protocol}//${u.host}${pathPrefix}/api/${projectId}/envelope/`,
      dsn,
    };
  } catch {
    return null;
  }
}

export function sentryEnabled() {
  if (!process.env.SENTRY_DSN) {
    warnOnce("sentry", "SENTRY_DSN is not set - errors are only written to the server logs.");
    return false;
  }
  return true;
}

// At most this many events per minute per server instance, so an error
// loop can't use up the Sentry quota.
const MAX_PER_MINUTE = 30;
let windowStart = 0;
let sentInWindow = 0;

function stackFrames(err: Error) {
  const lines = (err.stack || "").split("\n").slice(1, 30);
  const frames = lines
    .map((l) => l.trim().match(/^at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/))
    .filter(Boolean)
    .map((m) => ({ function: m![1] || "?", filename: m![2], lineno: Number(m![3]), colno: Number(m![4]) }));
  return frames.length ? { frames: frames.reverse() } : undefined;
}

export async function sendToSentry(level: Level, message: string, err?: unknown, extra?: Record<string, unknown>, tags?: Record<string, string>) {
  const cfg = parseDsn(process.env.SENTRY_DSN);
  if (!cfg) return;
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (++sentInWindow > MAX_PER_MINUTE) return;

  const eventId = crypto.randomUUID().replace(/-/g, "");
  const error = err instanceof Error ? err : null;
  const event: Record<string, unknown> = {
    event_id: eventId,
    timestamp: now / 1000,
    platform: "node",
    level,
    logger: "mentorsmd",
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV || "production",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    message: { formatted: message.slice(0, 8000) },
    tags: tags || {},
    extra: extra || {},
    ...(error
      ? { exception: { values: [{ type: error.name || "Error", value: (error.message || message).slice(0, 4000), stacktrace: stackFrames(error) }] } }
      : {}),
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date(now).toISOString(), dsn: cfg.dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
  try {
    await fetchWithTimeout(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${cfg.key}, sentry_client=mentorsmd/1.0`,
      },
      body,
    }, 3000);
  } catch {
    // Reporting must never break the app (and must not console.error,
    // which would loop back here).
  }
}

// Report something a person needs to look at. Awaitable; never throws.
export async function reportError(message: string, err?: unknown, extra?: Record<string, unknown>, level: Level = "error") {
  if (!sentryEnabled()) return;
  await sendToSentry(level, message, err, extra);
}

// Forward every server-side console.error to Sentry (in the background).
let installed = false;
export function captureConsoleErrors() {
  if (installed || !process.env.SENTRY_DSN) return;
  installed = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const err = args.find((a) => a instanceof Error) as Error | undefined;
      const text = args
        .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : safeJson(a)))
        .join(" ")
        .slice(0, 8000);
      // "[NEEDS MANUAL CHECK]" lines are sent by reportError() directly
      // (awaited, so they can't be lost); don't send them twice.
      if (/\[NEEDS MANUAL CHECK\]/.test(text)) return;
      runAfterResponse(() => sendToSentry("error", text, err));
    } catch {
      // ignore
    }
  };
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v)?.slice(0, 2000) ?? String(v);
  } catch {
    return String(v);
  }
}
