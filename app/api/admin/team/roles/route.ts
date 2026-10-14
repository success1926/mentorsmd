import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { cleanPermissions } from "@/lib/adminPermissions";
import { logAdminAction } from "@/lib/adminLog";

// Owners create a custom role (Admin -> Team -> Roles):
//   { name, permissions: ["people", "disputes", ...] }
// Keys come from lib/adminPermissions.ts; anything else is dropped.
export async function POST(req: Request) {
  const admin = await currentAdmin("team");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only the Owner can manage roles" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 40) return NextResponse.json({ error: "Give the role a name (up to 40 characters)" }, { status: 400 });
  if (/^(owner|admin)$/i.test(name)) return NextResponse.json({ error: "Owner and Admin are built in. Pick another name." }, { status: 400 });
  const permissions = cleanPermissions(body.permissions);
  if (permissions.length === 0) return NextResponse.json({ error: "Tick at least one area" }, { status: 400 });

  const taken = await prisma.adminCustomRole.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "There's already a role with that name" }, { status: 409 });

  const role = await prisma.adminCustomRole.create({ data: { name, permissions } });
  await logAdminAction({ adminId: admin.id, action: "TEAM_ROLE_CREATED", summary: `Created the role "${name}" (${permissions.join(", ")})`, targetType: "ROLE", targetId: role.id });
  return NextResponse.json({ ok: true, role });
}
