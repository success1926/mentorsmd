import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ADMIN_INVITE_DAYS, ADMIN_ROLE_LABEL, currentAdmin, newInviteToken } from "@/lib/adminTeam";
import { normalizeEmail } from "@/lib/validate";
import { SITE_URL, sendAdminInviteEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLog";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

// Owners invite a new admin by email (#114). The invitee picks their own
// name and password from the link, then sets up 2-step verification.
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  if (admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only Owners can manage the team" }, { status: 403 });
  const r = await rateLimit(RATE_LIMITS.teamInvitePerHour, admin.id);
  if (!r.ok) return tooMany(r.retryAfterSec);

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const adminRole = body.adminRole === "OWNER" ? "OWNER" : "ADMIN";

  const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { role: true, removedByAdmin: true } });
  if (existing && existing.role === "ADMIN" && !existing.removedByAdmin) return NextResponse.json({ error: "That person is already on the team" }, { status: 409 });
  if (existing && existing.role !== "ADMIN") {
    return NextResponse.json({ error: "That email already has a student or mentor account. Admins need their own email address (for example a work email)." }, { status: 409 });
  }

  // One open invite per email: cancel older ones.
  await prisma.adminInvite.updateMany({ where: { email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const { token, tokenHash } = newInviteToken();
  const invite = await prisma.adminInvite.create({
    data: { email, adminRole, tokenHash, invitedById: admin.id, expiresAt: new Date(Date.now() + ADMIN_INVITE_DAYS * 86400_000) },
  });
  await logAdminAction({
    adminId: admin.id,
    action: "TEAM_INVITE",
    summary: `Invited ${email} to the team as ${ADMIN_ROLE_LABEL[adminRole]}`,
    targetType: "INVITE",
    targetId: invite.id,
  });
  try {
    await sendAdminInviteEmail(email, admin.name, ADMIN_ROLE_LABEL[adminRole], `${SITE_URL}/join-team?token=${token}`);
    return NextResponse.json({ ok: true, emailSent: true });
  } catch (err) {
    console.error("Couldn't send the team invite:", err);
    return NextResponse.json({ ok: true, emailSent: false, warning: "The invite was created but the email failed. Use Resend." });
  }
}
