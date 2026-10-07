import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL, sendEmailVerificationEmail } from "@/lib/email";

// Students confirm their email before sending their first message.
// Counted as confirmed: emailVerified is set (link clicked, or signed in
// with Google), or the account already sent messages before this rule
// existed.
const TOKEN_TTL_HOURS = 48;

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function sendVerificationLink(user: { id: string; email: string; name: string }) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { tokenHash: hash(token), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000) },
  });
  await sendEmailVerificationEmail(user.email, user.name, `${SITE_URL}/api/email/verify?token=${token}`);
}

// Returns the user id on success, null for a bad/expired/used link.
export async function redeemVerificationToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  const claim = await prisma.emailVerificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claim.count === 0) return null;
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerified: new Date() } });
  return row.userId;
}

export async function isEmailConfirmed(user: { id: string; emailVerified: Date | null; role: string }): Promise<boolean> {
  if (user.role !== "BUYER" || user.emailVerified) return true;
  const [google, pastMessages] = await Promise.all([
    prisma.account.count({ where: { userId: user.id, provider: "google" } }),
    prisma.message.count({ where: { senderId: user.id } }),
  ]);
  if (google > 0 || pastMessages > 0) {
    // Remember it, so this check is a single read next time.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }).catch(() => {});
    return true;
  }
  return false;
}
