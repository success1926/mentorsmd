import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSIONS, can, type PermissionCheck } from "@/lib/adminPermissions";
import { getSession } from "@/lib/session";

// The admin team (#114-#118).
//
//  - Roles: OWNER manages the team (invite, change role, disable, remove,
//    reset 2-step, custom roles); ADMIN does everything else in Admin. An
//    admin account with no adminRole set counts as ADMIN. There must always
//    be at least one active Owner.
//  - Custom roles (AdminCustomRole): an ADMIN whose adminRoleId is set only
//    gets the areas ticked on that role (lib/adminPermissions.ts).
//  - Every admin login needs 2-step verification (authenticator app or an
//    emailed code) before the session counts as ADMIN. Until then the
//    session's role reads "ADMIN_2FA", so every existing admin check
//    (role === "ADMIN") refuses it. See lib/mfa.ts, lib/sessionRules.ts and
//    the jwt/session callbacks in lib/auth.ts.

export type AdminRole = "OWNER" | "ADMIN";
export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = { OWNER: "Owner", ADMIN: "Admin" };
export const PENDING_2FA_ROLE = "ADMIN_2FA";

export const normalizeAdminRole = (r: string | null | undefined): AdminRole => (r === "OWNER" ? "OWNER" : "ADMIN");

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  adminRole: AdminRole;
  // Custom role (Admin -> Team -> Roles), or null for full access.
  roleId: string | null;
  roleName: string; // "Owner", "Admin" or the custom role's name
  perms: string[]; // ["*"] for Owners and Admins
};

// The logged-in admin (2-step verification done), or null. With a
// permission key (or a list meaning "any of these"), also null when their
// role doesn't include it. Every admin page and /api/admin route calls this.
export async function currentAdmin(perm?: PermissionCheck): Promise<CurrentAdmin | null> {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "ADMIN") return null;
  const u = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: {
      id: true, name: true, email: true, role: true, adminRole: true, adminDisabledAt: true, removedByAdmin: true,
      adminCustomRole: { select: { id: true, name: true, permissions: true } },
    },
  });
  if (!u || u.role !== "ADMIN" || u.adminDisabledAt || u.removedByAdmin) return null;
  const adminRole = normalizeAdminRole(u.adminRole);
  // Owners always have everything, even if a role id was left behind.
  const custom = adminRole === "OWNER" ? null : u.adminCustomRole;
  const admin: CurrentAdmin = {
    id: u.id,
    name: u.name,
    email: u.email,
    adminRole,
    roleId: custom?.id ?? null,
    roleName: custom?.name ?? ADMIN_ROLE_LABEL[adminRole],
    perms: custom ? custom.permissions : [ALL_PERMISSIONS],
  };
  if (perm && !can(admin, perm)) return null;
  return admin;
}

// Ids of every active admin whose role includes this area (for sending
// them live updates, lib/realtime.ts).
export async function adminIdsWith(perm: PermissionCheck): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminDisabledAt: null, removedByAdmin: false },
    select: { id: true, adminRole: true, adminCustomRole: { select: { permissions: true } } },
  });
  return admins
    .filter((a) => {
      const custom = normalizeAdminRole(a.adminRole) === "OWNER" ? null : a.adminCustomRole;
      return can({ perms: custom ? custom.permissions : [ALL_PERMISSIONS] }, perm);
    })
    .map((a) => a.id);
}

// For routes students and mentors use too (orders, calls, invites): is the
// logged-in person an admin whose role includes this area?
export async function adminCan(perm: PermissionCheck) {
  return !!(await currentAdmin(perm));
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
  const invite = await prisma.adminInvite.findUnique({ where: { tokenHash: hash(token) }, include: { invitedBy: { select: { name: true } }, adminCustomRole: { select: { name: true } } } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

// What an invite or member's role is called: "Owner", "Admin" or the
// custom role's name.
export function roleLabelFor(r: { adminRole: string | null; adminCustomRole?: { name: string } | null }) {
  const base = normalizeAdminRole(r.adminRole);
  return base === "ADMIN" && r.adminCustomRole ? r.adminCustomRole.name : ADMIN_ROLE_LABEL[base];
}

// A custom role picked in the Team page (or null for full access).
export async function findCustomRole(roleId: unknown) {
  if (typeof roleId !== "string" || !roleId) return null;
  return prisma.adminCustomRole.findUnique({ where: { id: roleId }, select: { id: true, name: true } });
}
