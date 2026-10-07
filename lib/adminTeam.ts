import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The admin team (#114-#118).
//
//  - Roles: OWNER manages the team (invite, change role, disable, remove,
//    reset 2-step); ADMIN does everything else in Admin. An admin account
//    with no adminRole set counts as ADMIN. There must always be at least
//    one active Owner.
//  - Every admin login needs 2-step verification (authenticator app or an
//    emailed code) before the session counts as ADMIN. Until then the
//    session's role reads "ADMIN_2FA", so every existing admin check
//    (role === "ADMIN") refuses it. See the jwt/session callbacks in lib/auth.ts.

export type AdminRole = "OWNER" | "ADMIN";
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = { OWNER: "Owner", ADMIN: "Admin" };
export const PENDING_2FA_ROLE = "ADMIN_2FA";

export const normalizeAdminRole = (r: string | null | undefined): AdminRole => (r === "OWNER" ? "OWNER" : "ADMIN");

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// The logged-in admin (2-step verification done), or null.
export async function currentAdmin(): Promise<{ id: string; name: string; email: string; adminRole: AdminRole } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  const u = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, name: true, email: true, role: true, adminRole: true, adminDisabledAt: true, removedByAdmin: true },
  });
  if (!u || u.role !== "ADMIN" || u.adminDisabledAt || u.removedByAdmin) return null;
  return { id: u.id, name: u.name, email: u.email, adminRole: normalizeAdminRole(u.adminRole) };
}

// An admin who has logged in with their password but may not have
// finished 2-step verification yet (for the /admin/verify page's APIs).
export async function adminAwaiting2fa() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user || (role !== "ADMIN" && role !== PENDING_2FA_ROLE)) return null;
  const u = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { id: true, name: true, email: true, role: true, adminDisabledAt: true, removedByAdmin: true, twoFactorMethod: true, totpSecret: true, totpLastStep: true },
  });
  if (!u || u.role !== "ADMIN" || u.adminDisabledAt || u.removedByAdmin) return null;
  return u;
}

export async function activeOwnerCount(excludeUserId?: string) {
  return prisma.user.count({
    where: { role: "ADMIN", adminRole: "OWNER", adminDisabledAt: null, removedByAdmin: false, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
  });
}

// Ends every login of this account right away: admin sessions are
// re-checked on every request (lib/auth.ts), others within 5 minutes.
export async function revokeSessions(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { sessionsRevokedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
}

// ---- Team invites ----
export const ADMIN_INVITE_DAYS = 7;

export function newInviteToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hash(token) };
}

export async function inviteByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const invite = await prisma.adminInvite.findUnique({ where: { tokenHash: hash(token) }, include: { invitedBy: { select: { name: true } } } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}
