import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_INVITE_DAYS, ADMIN_ROLE_LABEL, currentAdmin, findCustomRole, newInviteToken } from "@/lib/adminTeam";
import { normalizeEmail } from "@/lib/validate";
import { sendAdminInviteEmail } from "@/lib/email";
import { siteUrl } from "@/lib/siteUrl";
import { logAdminAction } from "@/lib/adminLog";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

// Owners invite a new admin by email (#114). The invitee picks their own
// name and password from the link, then sets up 2-step verification.
export async function POST(req: Request) {
  const admin = await currentAdmin("team");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 });
  const r = await rateLimit(RATE_LIMITS.teamInvitePerHour, admin.id);
  if (!r.ok) return tooMany(r.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const adminRole = body.adminRole === "OWNER" ? "OWNER" : "ADMIN";
  // Optional custom role (Admin -> Team -> Roles); Owners always get everything.
  const customRole = adminRole === "ADMIN" ? await findCustomRole(body.roleId) : null;
  if (adminRole === "ADMIN" && body.roleId && !customRole) return NextResponse.json({ error: "That role no longer exists. Reload the page." }, { status: 400 });
  const roleLabel = customRole?.name ?? ADMIN_ROLE_LABEL[adminRole];

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { role: true, removedByAdmin: true } });
  if (existing && existing.role === "ADMIN" && !existing.removedByAdmin) return NextResponse.json({ error: "That person is already on the team" }, { status: 409 });
  if (existing && existing.role !== "ADMIN") {
    return NextResponse.json({ error: "That email already has a student or mentor account. Admins need their own email address (for example a work email)." }, { status: 409 });
  }

  // One open invite per email: cancel older ones.
  await prisma.adminInvite.updateMany({ where: { email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const { token, tokenHash } = newInviteToken();
  const invite = await prisma.adminInvite.create({
    data: { email, adminRole, adminRoleId: customRole?.id ?? null, tokenHash, invitedById: admin.id, expiresAt: new Date(Date.now() + ADMIN_INVITE_DAYS * 86400_000) },
  });
  await logAdminAction({
    adminId: admin.id,
    action: "TEAM_INVITE",
    summary: `Invited ${email} to the team as ${roleLabel}`,
    targetType: "INVITE",
    targetId: invite.id,
  });
  const link = `${siteUrl()}/join-team?token=${token}`;
  try {
    await sendAdminInviteEmail(email, admin.name, roleLabel, link);
    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    console.error("Couldn't send the team invite:", err);
    // Only Owners get here (checked above), so they can copy the link and
    // send it themselves.
    return NextResponse.json({ ok: true, emailSent: false, link, warning: `The invite was created but the email failed. Copy this link and send it to ${email} yourself (it works once, for ${ADMIN_INVITE_DAYS} days):` });
  }
}
