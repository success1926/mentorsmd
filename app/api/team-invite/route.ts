import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLE_LABEL, inviteByToken, normalizeAdminRole } from "@/lib/adminTeam";
import { LIMITS, isNonEmptyString } from "@/lib/validate";
import { logAdminAction } from "@/lib/adminLog";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

export const dynamic = "force-dynamic";

const MIN_ADMIN_PASSWORD = 12;

// The invite link from Admin -> Team (#114).
// GET ?token=  -> who the invite is for.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const invite = await inviteByToken(token);
  if (!invite) return NextResponse.json({ error: "This invite link isn't valid any more. Ask the Owner to send a new one." }, { status: 404 });
  return NextResponse.json({ email: invite.email, role: ADMIN_ROLE_LABEL[normalizeAdminRole(invite.adminRole)], invitedBy: invite.invitedBy?.name || null });
}

// POST { token, name, password } -> creates the admin account.
export async function POST(req: Request) {
  const r = await rateLimit(RATE_LIMITS.signupPerIpHour, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec);
  const body = await req.json().catch(() => ({}));
  const invite = await inviteByToken(typeof body.token === "string" ? body.token : "");
  if (!invite) return NextResponse.json({ error: "This invite link isn't valid any more. Ask the Owner to send a new one." }, { status: 400 });
  if (!isNonEmptyString(body.name, LIMITS.name)) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (typeof body.password !== "string" || body.password.length < MIN_ADMIN_PASSWORD || body.password.length > 200) {
    return NextResponse.json({ error: `Admin passwords need at least ${MIN_ADMIN_PASSWORD} characters` }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const adminRole = normalizeAdminRole(invite.adminRole);
  const existing = await prisma.user.findFirst({ where: { email: { equals: invite.email, mode: "insensitive" } } });
  if (existing && existing.role !== "ADMIN") {
    return NextResponse.json({ error: "This email already has a student or mentor account. Ask the Owner to invite a different email." }, { status: 409 });
  }
  if (existing && !existing.removedByAdmin) return NextResponse.json({ error: "You're already on the team. Log in instead." }, { status: 409 });

  const claim = await prisma.adminInvite.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
  if (claim.count === 0) return NextResponse.json({ error: "This invite was already used." }, { status: 409 });

  const data = {
    name: body.name.trim(),
    passwordHash,
    role: "ADMIN" as const,
    adminRole,
    adminDisabledAt: null,
    removedByAdmin: false,
    profileStatus: "ACTIVE" as const,
    removedAt: null,
    removedReason: null,
    emailVerified: new Date(),
    twoFactorMethod: null,
    totpSecret: null,
    totpLastStep: null,
    twoFactorEnabledAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: new Date(),
  };
  // Someone removed from the team earlier gets their old account back.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({ data: { ...data, email: invite.email.toLowerCase() } });
  await prisma.adminInvite.update({ where: { id: invite.id }, data: { acceptedUserId: user.id } });
  await logAdminAction({
    adminId: user.id,
    action: "TEAM_JOINED",
    summary: `${user.name} (${user.email}) joined the team as ${ADMIN_ROLE_LABEL[adminRole]}`,
    targetType: "USER",
    targetId: user.id,
    targetUserId: user.id,
  });
  return NextResponse.json({ ok: true, email: user.email });
}
