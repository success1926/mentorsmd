// One-click "Connect Google Calendar" for mentors. Separate from Google
// sign-in: it uses the same Google OAuth client, but asks only for
// permission to see free/busy times (never event names or details), and
// keeps its own refresh token, encrypted, on the User row. Server only.
//
// Flow: /api/calendar/google/start -> Google's consent screen ->
// /api/calendar/google/callback (stores the token) -> back to Account.
// Busy times are then read in lib/callBooking.ts (externalBusyFor), in the
// same 15-minute cache as the pasted iCal link.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { Interval } from "@/lib/schedule";
import { siteUrl } from "@/lib/siteUrl";

// The narrowest scope that can read busy times: "See the availability on
// Google Calendars you have access to". The FreeBusy API accepts it; it
// can't read event titles, guests or descriptions. "openid email" only
// tells us which Google account was connected, to show on Account.
export const GOOGLE_CAL_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const SCOPES = ["openid", "email", GOOGLE_CAL_SCOPE];

export const GOOGLE_CAL_STATE_COOKIE = "mmd_gcal_state";
const STATE_MAX_AGE_SEC = 10 * 60;
const FETCH_TIMEOUT_MS = 6000; // token refresh + FreeBusy together, inside Vercel's 10s limit

export function googleCalConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Must exactly match an "Authorized redirect URI" on the Google OAuth client.
export function googleCalRedirectUri() {
  return `${siteUrl()}/api/calendar/google/callback`;
}

// ---- Encryption of the stored refresh token (AES-256-GCM) ----
// The key comes from GOOGLE_CALENDAR_TOKEN_KEY. If that isn't set, it is
// derived from NEXTAUTH_SECRET instead, so the feature works without extra
// setup. Changing whichever one is used makes stored tokens unreadable:
// mentors would just see "Reconnect Google Calendar".
function tokenKey() {
  const secret = process.env.GOOGLE_CALENDAR_TOKEN_KEY || `${process.env.NEXTAUTH_SECRET || ""}:mentorsmd-gcal-token`;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ---- The "state" value (stops another site starting the flow for you) ----
// Signed "userId.expiry.nonce". It goes to Google in the address AND into a
// short-lived httpOnly cookie; the callback checks both match.
function stateSig(data: string) {
  return crypto.createHmac("sha256", `${process.env.NEXTAUTH_SECRET || ""}:gcal-state`).update(data).digest("base64url");
}

export function makeState(userId: string) {
  const data = `${userId}.${Date.now() + STATE_MAX_AGE_SEC * 1000}.${crypto.randomBytes(16).toString("base64url")}`;
  return { value: `${data}.${stateSig(data)}`, maxAge: STATE_MAX_AGE_SEC };
}

// The user id the state was made for, or null if it's forged, expired or
// doesn't match the cookie.
export function checkState(fromGoogle: string | null, fromCookie: string | undefined): string | null {
  if (!fromGoogle || !fromCookie) return null;
  const a = Buffer.from(fromGoogle);
  const b = Buffer.from(fromCookie);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const parts = fromGoogle.split(".");
  if (parts.length !== 4) return null;
  const [userId, exp, nonce, sig] = parts;
  const expected = stateSig(`${userId}.${exp}.${nonce}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (!(Number(exp) > Date.now())) return null;
  return userId;
}

export function googleConsentUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleCalRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // gives a refresh token, so we can check busy times later
    prompt: "consent", // always ask, so Google always returns a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// ---- Talking to Google ----

export class GoogleCalError extends Error {}

async function postForm(url: string, body: Record<string, string>, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal,
  });
  const json: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Swaps the one-time code from the callback for tokens. Returns the
// refresh token, the Google account's email and the scopes granted.
export async function exchangeCode(code: string) {
  const { ok, json } = await postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: googleCalRedirectUri(),
    grant_type: "authorization_code",
  });
  if (!ok) throw new GoogleCalError(`Google turned down the code (${json?.error || "unknown error"})`);
  // The id_token came straight from Google over HTTPS, so its contents can
  // be read without checking the signature (Google's own guidance).
  let email: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(String(json.id_token).split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.email === "string") email = payload.email;
  } catch {}
  const scopes = String(json.scope || "").split(/\s+/);
  return {
    refreshToken: typeof json.refresh_token === "string" ? (json.refresh_token as string) : null,
    accessToken: typeof json.access_token === "string" ? (json.access_token as string) : null,
    email,
    hasCalendarScope: scopes.includes(GOOGLE_CAL_SCOPE),
  };
}

async function accessTokenFrom(refreshToken: string, signal: AbortSignal) {
  const { ok, json } = await postForm(
    "https://oauth2.googleapis.com/token",
    {
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    },
    signal
  );
  if (ok && typeof json.access_token === "string") return json.access_token as string;
  if (json?.error === "invalid_grant") {
    throw new GoogleCalError("Google Calendar access was removed or has expired. Reconnect Google Calendar.");
  }
  throw new GoogleCalError("Google Calendar didn't answer. We'll try again in a few minutes.");
}

// Busy times on the mentor's main Google calendar between `from` and `to`
// (ms), in the same { s, e } shape the iCal reader produces.
export async function googleBusy(userId: string, from: number, to: number): Promise<Interval[]> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { googleCalRefreshToken: true } });
  const refreshToken = decryptToken(row?.googleCalRefreshToken);
  if (!refreshToken) throw new GoogleCalError("Google Calendar needs reconnecting. Reconnect Google Calendar.");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const accessToken = await accessTokenFrom(refreshToken, ctrl.signal);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: "primary" }] }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      // 403 also covers "Calendar API not enabled" on our side; the
      // mentor's fix is the same either way, and the server log has detail.
      console.error("Google FreeBusy refused:", res.status, json?.error?.message);
      throw new GoogleCalError("Google Calendar stopped sharing busy times. Reconnect Google Calendar.");
    }
    if (!res.ok) throw new GoogleCalError("Google Calendar didn't answer. We'll try again in a few minutes.");
    const cal = json?.calendars?.primary;
    if (cal?.errors?.length) throw new GoogleCalError("Google Calendar couldn't share busy times for your main calendar. Reconnect Google Calendar.");
    const busy: Interval[] = (Array.isArray(cal?.busy) ? cal.busy : [])
      .map((b: any) => ({ s: Date.parse(b.start), e: Date.parse(b.end) }))
      .filter((b: Interval) => b.s && b.e && b.e > b.s);
    return busy;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new GoogleCalError("Google Calendar took too long to answer. We'll try again in a few minutes.");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

// Best effort: tells Google to forget the permission. Note Google revokes
// the whole grant for our OAuth client (with include_granted_scopes the
// sign-in permission is part of it), so the next "Sign in with Google"
// may show Google's consent screen again. Signing in still works.
export async function revokeGoogleToken(stored: string | null | undefined) {
  const token = decryptToken(stored);
  if (!token) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    await postForm("https://oauth2.googleapis.com/revoke", { token }, ctrl.signal);
  } catch {
    // Ignored: we forget the token either way.
  } finally {
    clearTimeout(t);
  }
}
