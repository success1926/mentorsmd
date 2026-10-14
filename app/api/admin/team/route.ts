import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin, normalizeAdminRole, roleLabelFor } from "@/lib/adminTeam";

export const dynamic = "force-dynamic";

// Admin -> Team (#114-#117): admins, their role and 2-step status,
// pending invites and custom roles. Anyone whose role includes Team can
// see it; only Owners change it.
export async function GET() {
  const admin = await currentAdmin("team");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const [members, invites, roles] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", removedByAdmin: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, email: true, createdAt: true, adminRole: true, adminRoleId: true, adminDisabledAt: true, twoFactorMethod: true, twoFactorEnabledAt: true, lastActiveAt: true,
        adminCustomRole: { select: { name: true } },
      },
    }),
    prisma.adminInvite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } }, adminCustomRole: { select: { name: true } } },
    }),
    prisma.adminCustomRole.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { members: { where: { removedByAdmin: false } }, invites: { where: { acceptedAt: null, revokedAt: null } } } } },
    }),
  ]);
  return NextResponse.json({
    me: { id: admin.id, isOwner: admin.adminRole === "OWNER" },
    members: members.map(({ adminCustomRole, ...m }) => ({ ...m, adminRole: normalizeAdminRole(m.adminRole), roleName: roleLabelFor({ adminRole: m.adminRole, adminCustomRole }) })),
    invites: invites.map(({ tokenHash, adminCustomRole, ...i }) => ({ ...i, roleName: roleLabelFor({ adminRole: i.adminRole, adminCustomRole }), expired: i.expiresAt < new Date() })),
    roles: roles.map(({ _count, ...r }) => ({ ...r, members: _count.members, openInvites: _count.invites })),
  });
}
