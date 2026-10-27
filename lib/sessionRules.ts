// Login session limits. Edge-safe (no database), so both the auth
// callbacks and middleware.ts can use them.
//
//   Students and mentors: logged out after 7 days with no activity
//   (SESSION_IDLE_SECONDS, the cookie lifetime, renewed whenever they use
//   the site) and after 30 days no matter what (SESSION_MAX_AGE_MS).
//   Admins: logged out after 1 hour with no activity. The browser shows a
//   warning 2 minutes before (components/SessionWatcher.tsx) and the
//   server enforces it with a small grace period.

export const SESSION_IDLE_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const ADMIN_IDLE_MS = 60 * 60 * 1000;
export const ADMIN_WARN_BEFORE_MS = 2 * 60 * 1000;
// Server-side allowance on top of ADMIN_IDLE_MS, so the browser's own
// timer always fires first and shows the friendly message.
const ADMIN_IDLE_GRACE_MS = 5 * 60 * 1000;

type TokenLike = { [key: string]: unknown; role?: unknown; issuedAtMs?: unknown; lastSeenMs?: unknown; revoked?: unknown } | null | undefined;

// Why a still-present token should no longer count as logged in, or null.
export function sessionEndReason(token: TokenLike, now = Date.now()): "revoked" | "expired" | "idle" | null {
  if (!token) return null;
  if (token.revoked) return "revoked";
  const issued = typeof token.issuedAtMs === "number" ? token.issuedAtMs : 0;
  if (issued && now - issued > SESSION_MAX_AGE_MS) return "expired";
  if (token.role === "ADMIN") {
    const lastSeen = typeof token.lastSeenMs === "number" ? token.lastSeenMs : issued;
    if (lastSeen && now - lastSeen > ADMIN_IDLE_MS + ADMIN_IDLE_GRACE_MS) return "idle";
  }
  return null;
}

// Students land on their Home ("What's next", student area v2, Oct 2026).
export function homeForRole(role: unknown) {
  return role === "SELLER" || role === "BUYER" ? "/dashboard" : role === "ADMIN" ? "/admin" : "/mentors";
}

// ---- 2-step verification (lib/mfa.ts) ----
// After the password (or Google), anyone who needs the second step gets a
// "pending" role until they enter their code: ADMIN_2FA, SELLER_2FA or
// BUYER_2FA. Every existing check for "ADMIN", "SELLER" or "BUYER" refuses
// those, and middleware.ts sends them to the code page.
//   Admins: every login (token.mfa).
//   Mentors, and students who turned it on: logins since 2-step for them
//   started (token.needs2fa), so nobody already logged in is thrown out.
export const PENDING_2FA_SUFFIX = "_2FA";

export function isPending2faRole(role: unknown): boolean {
  return typeof role === "string" && role.endsWith(PENDING_2FA_SUFFIX);
}

export function twoStepPending(token: TokenLike): boolean {
  if (!token || token.mfa === true) return false;
  return token.role === "ADMIN" || token.needs2fa === true;
}

// The session role to show for this token.
export function sessionRole(token: TokenLike): unknown {
  return twoStepPending(token) ? `${token!.role}${PENDING_2FA_SUFFIX}` : token?.role;
}

// Where someone with a pending role enters their code.
export function verifyPathFor(role: unknown) {
  return role === "ADMIN" || role === "ADMIN_2FA" ? "/admin/verify" : "/two-step";
}

// Where to go after the code: only a page on this site (never another
// website), and never back to a code page.
export function safeNext(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/two-step") || value.startsWith("/admin/verify")) return fallback;
  return value;
}
