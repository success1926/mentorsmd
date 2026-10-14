import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimit } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";
import { sendToSentry, sentryEnabled } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// Page errors from the browser (app/error.tsx, app/global-error.tsx),
// forwarded to Sentry. Anyone can call it, so it's rate limited per
// connection and only keeps three harmless things:
//   - the page address, without the query string, and with long codes in
//     it (private links, ids) replaced by ":id"
//   - the kind of error (e.g. "TypeError"), never its message, which can
//     contain things people typed
//   - Next's error digest (a short code that matches the server log)
// Does nothing when SENTRY_DSN isn't set.
function cleanPath(v: unknown) {
  if (typeof v !== "string" || !v.startsWith("/")) return "/";
  return (
    v
      .split(/[?#]/)[0]
      .split("/")
      .map((seg) => (seg.length >= 16 || /\d{4,}|@/.test(seg) ? ":id" : seg))
      .join("/")
      .slice(0, 200) || "/"
  );
}

const clean = (v: unknown, re: RegExp, max: number) => (typeof v === "string" && re.test(v) ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  if (!sentryEnabled()) return ok;
  const limit = await rateLimit(RATE_LIMITS.clientErrorPerIpHour, ipKey(req));
  if (!limit.ok) return ok;

  const body = await req.json().catch(() => ({}));
  const path = cleanPath(body?.path);
  const name = clean(body?.name, /^[A-Za-z][A-Za-z0-9_]{0,40}$/, 40) || "Error";
  const digest = clean(body?.digest, /^[A-Za-z0-9_-]{1,40}$/, 40);
  const where = body?.where === "global" ? "global" : "page";
  await sendToSentry("error", `Browser ${where} error: ${name} on ${path}`, undefined, { path, digest, where }, { source: "browser", path });
  return ok;
}
