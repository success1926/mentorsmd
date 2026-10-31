import crypto from "crypto";
import type { Session } from "next-auth";
import { decode, encode, type JWT } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_IDLE_MS } from "@/lib/sessionRules";

// Sign-in for the MentorsMD phone app (React Native, Oct 2026).
//
// The website's login is a browser cookie. The app can't use that, so it
// signs in through /api/app/auth/* and gets two tokens:
//   - an access token, sent as "Authorization: Bearer <token>" on every
//     API call. It's the same kind of encrypted token as the website's
//     login cookie (so the same checks run on it: role changes, removed
//     accounts, "sign out of other devices", the admin idle limit), but
//     sealed with its own salt so the two can't be swapped, and it only
//     lasts 15 minutes.
//   - a refresh token, kept in the phone's secure storage and traded for a
//     new pair at /api/app/auth/refresh. Only its hash is stored, in
//     AppSession, one row per phone. It runs out after 30 days without use
//     (1 hour for admins, as on the website).
// The app must send one refresh at a time: each refresh replaces the
// refresh token, so a second refresh with the old one is refused.
//
// 2-step verification works as on the website: after the password, anyone
// who needs it (lib/mfa.ts) gets a 10-minute "challenge" instead of tokens,
// and enters their code at /api/app/auth/two-step. "Trust this device"
// gives the app the same signed value as the website's trust cookie, which
// it sends with its next sign-in.
//
// Off on the live site until APP_SIGN_IN=1 is set there (previews and local
// development always have it), so nothing is reachable before the app's
// own bot check (Apple App Attest / Google Play Integrity) is in.

export const ACCESS_TOKEN_SECONDS = 15 * 60;
export const APP_IDLE_DAYS = 30;
const CHALLENGE_SECONDS = 10 * 60;
const ACCESS_SALT = "mentorsmd-app-access";
const CHALLENGE_SALT = "mentorsmd-app-2fa";
// Allowance on top of the admin 1-hour limit, as on the website.
const ADMIN_IDLE_GRACE_MS = 5 * 60 * 1000;

export function appSignInEnabled() {
  return process.env.VERCEL_ENV !== "production" || process.env.APP_SIGN_IN === "1";
}

export const PLATFORMS = ["IOS", "ANDROID"] as const;
export function cleanPlatform(value: unknown): string | null {
  const v = String(value || "").toUpperCase();
  return (PLATFORMS as readonly string[]).includes(v) ? v : null;
}
// "Maya's iPhone": shown in Settings so people can tell their phones apart.
export function cleanDeviceName(value: unknown): string | null {
  const v = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 60);
  return v || null;
}

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

type AppUser = { id: string; email: string; name: string; role: string };

// ---- Sessions and tokens ----

function idleLimitMs(role: string) {
  return role === "ADMIN" ? ADMIN_IDLE_MS + ADMIN_IDLE_GRACE_MS : APP_IDLE_DAYS * 86400_000;
}

async function accessToken(user: AppUser, sessionId: string) {
  const now = Date.now();
  const token: JWT = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    // Same fields as the website's login cookie (lib/auth.ts). The 2-step
    // code (if needed) was entered before any app session was made.
    issuedAtMs: now,
    lastSeenMs: now,
    roleCheckedAt: now,
    needs2fa: false,
    mfa: true,
    appSid: sessionId,
  };
  return encode({ token, secret: secret(), salt: ACCESS_SALT, maxAge: ACCESS_TOKEN_SECONDS });
}

function newRefreshToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export type AppTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; name: string; email: string; role: string };
};

async function tokensFor(user: AppUser, sessionId: string, refreshToken: string): Promise<AppTokens> {
  return {
    accessToken: await accessToken(user, sessionId),
    refreshToken,
    expiresIn: ACCESS_TOKEN_SECONDS,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

// A new phone session, once the password (and 2-step code) are done.
export async function startAppSession(user: AppUser, platform: string, deviceName: string | null): Promise<AppTokens> {
  const refreshToken = newRefreshToken();
  const row = await prisma.appSession.create({
    data: { userId: user.id, refreshHash: hash(refreshToken), platform, deviceName },
    select: { id: true },
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  return tokensFor(user, row.id, refreshToken);
}

const SESSION_USER = {
  id: true, name: true, email: true, role: true, removedByAdmin: true, adminDisabledAt: true,
  passwordChangedAt: true, sessionsRevokedAt: true,
} as const;

type SessionRow = {
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  user: { role: string; removedByAdmin: boolean; adminDisabledAt: Date | null; passwordChangedAt: Date | null; sessionsRevokedAt: Date | null };
};

// Is this phone session still good? Everything that ends a website login
// ends it too.
export function appSessionActive(row: SessionRow, now = Date.now()): boolean {
  const u = row.user;
  if (row.revokedAt || u.removedByAdmin || u.adminDisabledAt) return false;
  const started = row.createdAt.getTime();
  if (u.passwordChangedAt && u.passwordChangedAt.getTime() > started) return false;
  if (u.sessionsRevokedAt && u.sessionsRevokedAt.getTime() > started) return false;
  return now - row.lastUsedAt.getTime() <= idleLimitMs(u.role);
}

// A new token pair for a refresh token, or null if it's no longer good
// (the app then shows the sign-in screen).
export async function refreshAppSession(refreshToken: string): Promise<AppTokens | null> {
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 200) return null;
  const oldHash = hash(refreshToken);
  const row = await prisma.appSession.findUnique({ where: { refreshHash: oldHash }, include: { user: { select: SESSION_USER } } });
  if (!row || !appSessionActive(row)) return null;
  const next = newRefreshToken();
  // Claimed in one step, so the same refresh token can't be used twice.
  const claim = await prisma.appSession.updateMany({
    where: { id: row.id, refreshHash: oldHash, revokedAt: null },
    data: { refreshHash: hash(next), lastUsedAt: new Date() },
  });
  if (claim.count !== 1) return null;
  if (Date.now() - row.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.user.update({ where: { id: row.userId }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  return tokensFor(row.user, row.id, next);
}

// Signing out in the app.
export async function endAppSessionByRefresh(refreshToken: string) {
  if (typeof refreshToken !== "string" || !refreshToken) return;
  await prisma.appSession.updateMany({ where: { refreshHash: hash(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

// "Sign out" on one phone in Settings.
export async function endAppSession(userId: string, sessionId: string): Promise<boolean> {
  const r = await prisma.appSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}

// The phones signed in to this account, newest use first (Settings).
export async function activeAppSessions(userId: string) {
  const rows = await prisma.appSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastUsedAt: "desc" },
    take: 50,
    include: { user: { select: SESSION_USER } },
  });
  return rows
    .filter((r) => appSessionActive(r))
    .map((r) => ({ id: r.id, platform: r.platform, deviceName: r.deviceName, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt }));
}

// ---- Requests from the app ----

// The access token from "Authorization: Bearer ...", "" when the header is
// there but empty or malformed, null when there's no such header.
export function bearerFrom(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return m ? m[1] : "";
}

// The same session object getServerSession gives for a website login, for
// an app access token. Runs the website's own jwt and session callbacks,
// so every rule about who is still logged in applies. Null when the token
// is invalid, expired or ended.
export async function sessionFromAccessToken(raw: string): Promise<(Session & { appSessionId: string }) | null> {
  if (!raw) return null;
  let token: JWT | null = null;
  try {
    token = await decode({ token: raw, secret: secret(), salt: ACCESS_SALT });
  } catch {
    return null;
  }
  if (!token?.sub || typeof token.appSid !== "string") return null;
  const cb = authOptions.callbacks!;
  const checked = (await cb.jwt!({ token, user: undefined as any, account: null } as any)) as JWT;
  if (!checked || checked.revoked) return null;
  const base = { user: { name: checked.name, email: checked.email, image: null }, expires: new Date(((token.exp as number) || 0) * 1000).toISOString() };
  const session = (await cb.session!({ session: base, token: checked } as any)) as Session;
  if (!session?.user) return null;
  return { ...session, appSessionId: token.appSid };
}

// ---- 2-step challenge ----
// What the app holds between the password and the code: who is signing in
// and from which phone. Sealed, and good for 10 minutes.

export async function makeChallenge(userId: string, platform: string, deviceName: string | null) {
  return encode({ token: { sub: userId, platform, deviceName, purpose: "app-2fa" }, secret: secret(), salt: CHALLENGE_SALT, maxAge: CHALLENGE_SECONDS });
}

export async function readChallenge(raw: unknown): Promise<{ userId: string; platform: string; deviceName: string | null } | null> {
  if (typeof raw !== "string" || !raw || raw.length > 2000) return null;
  try {
    const t = await decode({ token: raw, secret: secret(), salt: CHALLENGE_SALT });
    if (!t?.sub || t.purpose !== "app-2fa") return null;
    const platform = cleanPlatform(t.platform);
    if (!platform) return null;
    return { userId: t.sub, platform, deviceName: cleanDeviceName(t.deviceName) };
  } catch {
    return null;
  }
}
