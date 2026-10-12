import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin, normalizeAdminRole } from "@/lib/adminTeam";

export const dynamic = "force-dynamic";

// Admin -> Team (#114-#117): admins, their role and 2-step status, and
// pending invites. Every admin can see the team; only Owners change it.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", removedByAdmin: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true, adminRole: true, adminDisabledAt: true, twoFactorMethod: true, twoFactorEnabledAt: true, lastActiveAt: true },
    }),
    prisma.adminInvite.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { name: true } } },
    }),
  ]);
  return NextResponse.json({
    me: { id: admin.id, isOwner: admin.adminRole === "OWNER" },
    members: members.map((m) => ({ ...m, adminRole: normalizeAdminRole(m.adminRole) })),
    invites: invites.map(({ tokenHash, ...i }) => ({ ...i, expired: i.expiresAt < new Date() })),
  });
}
