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

export function homeForRole(role: unknown) {
  return role === "SELLER" ? "/dashboard" : role === "ADMIN" ? "/admin" : "/mentors";
}
