import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_INVITE_DAYS, ADMIN_ROLE_LABEL, currentAdmin, newInviteToken, normalizeAdminRole } from "@/lib/adminTeam";
import { SITE_URL, sendAdminInviteEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLog";

async function owner() {
  const admin = await currentAdmin();
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  if (admin.adminRole !== "OWNER") return { error: NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 }) };
  return { admin };
}

// Resend: a fresh link (the old one stops working), valid 7 more days.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { admin, error } = await owner();
  if (error) return error;
  const invite = await prisma.adminInvite.findUnique({ where: { id: params.id } });
  if (!invite || invite.acceptedAt || invite.revokedAt) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  const { token, tokenHash } = newInviteToken();
  await prisma.adminInvite.update({ where: { id: invite.id }, data: { tokenHash, expiresAt: new Date(Date.now() + ADMIN_INVITE_DAYS * 86400_000) } });
  try {
    await sendAdminInviteEmail(invite.email, admin!.name, ADMIN_ROLE_LABEL[normalizeAdminRole(invite.adminRole)], `${SITE_URL}/join-team?token=${token}`);
  } catch (err) {
    console.error("Couldn't resend the team invite:", err);
    return NextResponse.json({ error: "The email failed to send. Try again in a minute." }, { status: 502 });
  }
  await logAdminAction({ adminId: admin!.id, action: "TEAM_INVITE_RESENT", summary: `Re-sent the team invite to ${invite.email}`, targetType: "INVITE", targetId: invite.id });
  return NextResponse.json({ ok: true });
}

// Cancel an invite: its link stops working.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { admin, error } = await owner();
  if (error) return error;
  const invite = await prisma.adminInvite.findUnique({ where: { id: params.id } });
  if (!invite || invite.acceptedAt) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  await prisma.adminInvite.update({ where: { id: invite.id }, data: { revokedAt: invite.revokedAt ?? new Date() } });
  await logAdminAction({ adminId: admin!.id, action: "TEAM_INVITE_CANCELLED", summary: `Cancelled the team invite for ${invite.email}`, targetType: "INVITE", targetId: invite.id });
  return NextResponse.json({ ok: true });
}
