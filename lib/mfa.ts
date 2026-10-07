import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAdminCodeEmail } from "@/lib/email";

// Admin 2-step verification helpers that lib/auth.ts also uses (kept out
// of lib/adminTeam.ts, which imports lib/auth.ts).

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// ---- Emailed codes ----
const EMAIL_CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

export async function sendAdminEmailCode(user: { id: string; email: string }) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.adminMfaToken.updateMany({ where: { userId: user.id, kind: "EMAIL_CODE", usedAt: null }, data: { usedAt: new Date() } });
  await prisma.adminMfaToken.create({
    data: { userId: user.id, kind: "EMAIL_CODE", tokenHash: hash(`${user.id}:${code}`), expiresAt: new Date(Date.now() + EMAIL_CODE_MINUTES * 60_000) },
  });
  await sendAdminCodeEmail(user.email, code);
}

export async function checkAdminEmailCode(userId: string, code: string): Promise<boolean> {
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

