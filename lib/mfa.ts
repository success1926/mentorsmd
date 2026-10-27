import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAdminCodeEmail, sendLoginCodeEmail } from "@/lib/email";

// 2-step verification helpers that lib/auth.ts also uses (kept out of
// lib/adminTeam.ts, which imports lib/auth.ts).
//
// Who needs the second step:
//   - Admins: always (authenticator app or email codes).
//   - Mentors: always. A mentor who hasn't picked a method gets email codes,
//     so existing mentors just get a code on their next login.
//   - Students: only if they turned it on in Settings.
// "Trust this device for 30 days" sets a signed cookie, so that browser
// skips the code until it runs out, the password changes, all sessions are
// ended, or the person presses "Forget my trusted devices".
// The codes and one-time tickets live in the AdminMfaToken table (named
// from when only admins had 2-step).

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function needsTwoStep(user: { role: string; twoFactorMethod: string | null }) {
  return user.role === "ADMIN" || user.role === "SELLER" || (user.role === "BUYER" && !!user.twoFactorMethod);
}

// ---- Emailed codes ----
const EMAIL_CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
// A new code at most this often, so refreshing the page doesn't send a pile.
const RESEND_SECONDS = 30;

// Emails a fresh code. Returns false (and sends nothing) when a code went
// out in the last 30 seconds; that one still works.
export async function sendEmailCode(user: { id: string; email: string; role: string }): Promise<boolean> {
  const recent = await prisma.adminMfaToken.findFirst({
    where: { userId: user.id, kind: "EMAIL_CODE", usedAt: null, createdAt: { gt: new Date(Date.now() - RESEND_SECONDS * 1000) } },
    select: { id: true },
  });
  if (recent) return false;
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.adminMfaToken.updateMany({ where: { userId: user.id, kind: "EMAIL_CODE", usedAt: null }, data: { usedAt: new Date() } });
  await prisma.adminMfaToken.create({
    data: { userId: user.id, kind: "EMAIL_CODE", tokenHash: hash(`${user.id}:${code}`), expiresAt: new Date(Date.now() + EMAIL_CODE_MINUTES * 60_000) },
  });
  if (user.role === "ADMIN") await sendAdminCodeEmail(user.email, code);
  else await sendLoginCodeEmail(user.email, code);
  return true;
}

export async function checkEmailCode(userId: string, code: string): Promise<boolean> {
  const clean = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const row = await prisma.adminMfaToken.findFirst({
    where: { userId, kind: "EMAIL_CODE", usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return false;
  const a = Buffer.from(row.tokenHash);
  const b = Buffer.from(hash(`${userId}:${clean}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await prisma.adminMfaToken.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  const claim = await prisma.adminMfaToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return claim.count === 1;
}

// ---- Session tickets ----
// Once the code is right, the browser gets a one-time ticket and hands it
// to the login session (useSession().update), which marks it verified.
const TICKET_SECONDS = 120;

export async function issueMfaTicket(userId: string): Promise<string> {
  const ticket = crypto.randomBytes(32).toString("hex");
  await prisma.adminMfaToken.create({
    data: { userId, kind: "SESSION", tokenHash: hash(ticket), expiresAt: new Date(Date.now() + TICKET_SECONDS * 1000) },
  });
  return ticket;
}

export async function redeemMfaTicket(userId: string, ticket: unknown): Promise<boolean> {
  if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket)) return false;
  const claim = await prisma.adminMfaToken.updateMany({
    where: { userId, kind: "SESSION", tokenHash: hash(ticket), usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return claim.count === 1;
}

// ---- Trusted devices ----
export const TRUST_DAYS = 30;
// One cookie per account, so two people sharing a computer don't mix.
export const trustCookieName = (userId: string) => `mmd_trust_${userId.slice(-10)}`;

function sign(text: string) {
  return crypto.createHmac("sha256", `${process.env.NEXTAUTH_SECRET || ""}:mentorsmd-trusted-device`).update(text).digest("base64url");
}

// The cookie value for "trust this device" (userId.timeMs.signature).
export function trustCookieValue(userId: string, now = Date.now()) {
  return `${userId}.${now}.${sign(`${userId}.${now}`)}`;
}

// Is this cookie a valid "trust this device" for this person? It must be
// signed by us, under 30 days old, and newer than their last password
// change, "end all sessions" and "forget my trusted devices".
export async function isTrustedDevice(userId: string, cookieValue: string | undefined): Promise<boolean> {
  const parts = (cookieValue || "").split(".");
  if (parts.length !== 3 || parts[0] !== userId || !/^\d{10,}$/.test(parts[1])) return false;
  const expected = Buffer.from(sign(`${userId}.${parts[1]}`));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
  const at = Number(parts[1]);
  if (at + TRUST_DAYS * 86400_000 < Date.now() || at > Date.now() + 60_000) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorTrustAfter: true, passwordChangedAt: true, sessionsRevokedAt: true } });
  if (!u) return false;
  return [u.twoFactorTrustAfter, u.passwordChangedAt, u.sessionsRevokedAt].every((d) => !d || at >= d.getTime());
}

// At login (lib/auth.ts): does this login need the code, and is this
// browser trusted for this person? Reads the cookie from the login request.
export async function twoStepAtLogin(userId: string): Promise<{ needs: boolean; trusted: boolean }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, twoFactorMethod: true } });
  if (!u || !needsTwoStep(u)) return { needs: false, trusted: false };
  let cookie: string | undefined;
  try {
    const { cookies } = await import("next/headers");
    cookie = cookies().get(trustCookieName(userId))?.value;
  } catch {
    cookie = undefined;
  }
  return { needs: true, trusted: await isTrustedDevice(userId, cookie) };
}

// "Forget my trusted devices": every browser needs a code again.
export async function forgetTrustedDevices(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { twoFactorTrustAfter: new Date() } });
}
