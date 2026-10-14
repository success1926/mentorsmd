import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { isActiveAdmin, isLeadStatus, leadStatusLabel } from "@/lib/leads";
import { leadsAdmin, parseKind } from "@/lib/leadQueries";

// Change a lead's status and/or who it's assigned to.
// Body: { kind, status?, assignedToId? (null = unassigned) }.
// Mentor applications only take assignedToId here: their Pending /
// Invited / Declined decision uses the Invite and Decline buttons
// (/api/admin/applications/[id]).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; status?: unknown; assignedToId?: unknown };
  const kind = parseKind(body.kind);
  if (!kind) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  const admin = await leadsAdmin(kind);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const data: { status?: string; assignedToId?: string | null } = {};
  if (body.status !== undefined) {
    if (kind === "APPLICATION" || !isLeadStatus(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    data.status = body.status;
  }
  if (body.assignedToId !== undefined) {
    if (body.assignedToId === null || body.assignedToId === "") data.assignedToId = null;
    else if (typeof body.assignedToId === "string" && (await isActiveAdmin(body.assignedToId))) data.assignedToId = body.assignedToId;
    else return NextResponse.json({ error: "Pick someone on the admin team." }, { status: 400 });
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  let who: string;
  if (kind === "APPLICATION") {
    const app = await prisma.mentorApplication.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.mentorApplication.update({ where: { id: app.id }, data: { assignedToId: data.assignedToId } });
    who = `the mentor application from ${app.name}`;
  } else {
    const lead = await prisma.lead.findFirst({ where: { id: params.id, kind }, select: { id: true, email: true, name: true } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.lead.update({ where: { id: lead.id }, data });
    who = kind === "CONTACT" ? `the contact message from ${lead.name || lead.email}` : `the waitlist signup ${lead.email}`;
  }

  const parts: string[] = [];
  if (data.status) parts.push(`marked ${who} ${leadStatusLabel(data.status)}`);
  if (data.assignedToId !== undefined) {
    const name = data.assignedToId ? (await prisma.user.findUnique({ where: { id: data.assignedToId }, select: { name: true } }))?.name : null;
    parts.push(name ? `assigned ${who} to ${name}` : `unassigned ${who}`);
  }
  const summary = parts.join("; ");
  await logAdminAction({
    adminId: admin.id,
    action: "LEAD_UPDATED",
    summary: summary.charAt(0).toUpperCase() + summary.slice(1),
    targetType: kind === "APPLICATION" ? "APPLICATION" : "LEAD",
    targetId: params.id,
  });
  return NextResponse.json({ ok: true });
}
