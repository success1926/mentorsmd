import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_INVITE_DAYS, currentAdmin, newInviteToken, roleLabelFor } from "@/lib/adminTeam";
import { sendAdminInviteEmail } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import { logAdminAction } from "@/lib/adminLog";

async function owner() {
  const admin = await currentAdmin("team");
  if (!admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  if (admin.adminRole !== "OWNER") return { error: NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 }) };
  return { admin };
}

// Resend: a fresh link (the old one stops working), valid 7 more days.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { admin, error } = await owner();
  if (error) return error;
  const invite = await prisma.adminInvite.findUnique({ where: { id: params.id }, include: { adminCustomRole: { select: { name: true } } } });
  if (!invite || invite.acceptedAt || invite.revokedAt) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  const { token, tokenHash } = newInviteToken();
  await prisma.adminInvite.update({ where: { id: invite.id }, data: { tokenHash, expiresAt: new Date(Date.now() + ADMIN_INVITE_DAYS * 86400_000) } });
  const link = `${siteUrl()}/join-team?token=${token}`;
  await logAdminAction({ adminId: admin!.id, action: "TEAM_INVITE_RESENT", summary: `Re-sent the team invite to ${invite.email}`, targetType: "INVITE", targetId: invite.id });
  try {
    await sendAdminInviteEmail(invite.email, admin!.name, roleLabelFor(invite), link);
  } catch (err) {
    console.error("Couldn't resend the team invite:", err);
    // The new link already works, so the Owner can copy it and send it themselves.
    return NextResponse.json({ ok: true, emailSent: false, link, warning: `The email failed to send. Copy this new link and send it to ${invite.email} yourself (it works once, for ${ADMIN_INVITE_DAYS} days):` });
  }
  return NextResponse.json({ ok: true, emailSent: true });
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
