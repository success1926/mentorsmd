import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PENDING_2FA_SUFFIX } from "@/lib/sessionRules";

// Server helpers for the 2-step pages (/admin/verify, /two-step) and the
// 2-step part of Settings. The code checks themselves are in lib/mfa.ts.

const SELECT = {
  id: true, name: true, email: true, role: true, adminDisabledAt: true, removedByAdmin: true,
  twoFactorMethod: true, totpSecret: true, totpLastStep: true,
} as const;

// The logged-in person, whether or not they've entered their code yet
// (their session role may be "ADMIN_2FA", "SELLER_2FA" or "BUYER_2FA").
export async function personAwaiting2fa() {
  const session = await getServerSession(authOptions);
  const s = session?.user as any;
  if (!s?.id || typeof s.role !== "string") return null;
  const u = await prisma.user.findUnique({ where: { id: s.id }, select: SELECT });
  if (!u || u.removedByAdmin || u.adminDisabledAt) return null;
  // The session's role (without the pending ending) must still match.
  if (s.role.replace(PENDING_2FA_SUFFIX, "") !== u.role) return null;
  return u;
}

// The logged-in mentor or student who has finished logging in (for
// Settings). Admins' 2-step is managed in Admin -> Team.
export async function memberForTwoStepSettings() {
  const session = await getServerSession(authOptions);
  const s = session?.user as any;
  if (!s?.id || (s.role !== "SELLER" && s.role !== "BUYER")) return null;
  const u = await prisma.user.findUnique({ where: { id: s.id }, select: { ...SELECT, twoFactorTrustAfter: true } });
  if (!u || u.removedByAdmin || u.role !== s.role) return null;
  return u;
}

export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export const trustCookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSec,
});
