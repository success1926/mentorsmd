import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { cleanPermissions } from "@/lib/adminPermissions";
import { logAdminAction } from "@/lib/adminLog";

async function owner() {
  const admin = await currentAdmin("team");
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  if (admin.adminRole !== "OWNER") return { error: NextResponse.json({ error: "Only the Owner can manage roles" }, { status: 403 }) };
  return { admin };
}

// Rename a role or change its tick boxes: { name?, permissions? }.
// Takes effect on the members' very next click (checked on every request).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { admin, error } = await owner();
  if (error) return error;
  const role = await prisma.adminCustomRole.findUnique({ where: { id: params.id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; permissions?: string[] } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 40) return NextResponse.json({ error: "Give the role a name (up to 40 characters)" }, { status: 400 });
    if (/^(owner|admin)$/i.test(name)) return NextResponse.json({ error: "Owner and Admin are built in. Pick another name." }, { status: 400 });
    const taken = await prisma.adminCustomRole.findFirst({ where: { name: { equals: name, mode: "insensitive" }, id: { not: role.id } }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "There's already a role with that name" }, { status: 409 });
    data.name = name;
  }
  if (body.permissions !== undefined) {
    const permissions = cleanPermissions(body.permissions);
    if (permissions.length === 0) return NextResponse.json({ error: "Tick at least one area" }, { status: 400 });
    data.permissions = permissions;
  }
  const updated = await prisma.adminCustomRole.update({ where: { id: role.id }, data });
  await logAdminAction({
    adminId: admin!.id,
    action: "TEAM_ROLE_UPDATED",
    summary: `Updated the role "${updated.name}" (${updated.permissions.join(", ")})`,
    targetType: "ROLE",
    targetId: role.id,
    details: { before: { name: role.name, permissions: role.permissions } },
  });
  return NextResponse.json({ ok: true, role: updated });
}

// Delete a role. Blocked while a team member or an open invite uses it.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { admin, error } = await owner();
  if (error) return error;
  const role = await prisma.adminCustomRole.findUnique({ where: { id: params.id } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });

  const [members, openInvites] = await Promise.all([
    prisma.user.count({ where: { adminRoleId: role.id, removedByAdmin: false } }),
    prisma.adminInvite.count({ where: { adminRoleId: role.id, acceptedAt: null, revokedAt: null } }),
  ]);
  if (members > 0 || openInvites > 0) {
    const what = [members ? `${members} team member${members === 1 ? "" : "s"}` : "", openInvites ? `${openInvites} open invite${openInvites === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
    return NextResponse.json({ error: `This role is used by ${what}. Give them another role (or cancel the invite) first.` }, { status: 400 });
  }
  // Removed members and used or cancelled invites may still point at it.
  await prisma.$transaction([
    prisma.user.updateMany({ where: { adminRoleId: role.id }, data: { adminRoleId: null } }),
    prisma.adminInvite.updateMany({ where: { adminRoleId: role.id }, data: { adminRoleId: null } }),
    prisma.adminCustomRole.delete({ where: { id: role.id } }),
  ]);
  await logAdminAction({ adminId: admin!.id, action: "TEAM_ROLE_DELETED", summary: `Deleted the role "${role.name}"`, targetType: "ROLE", targetId: role.id });
  return NextResponse.json({ ok: true });
}
