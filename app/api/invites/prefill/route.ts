import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";
import { applicationSchoolForInvite } from "@/lib/applications";

export const dynamic = "force-dynamic";

// The mentor join page (/become-a-mentor/join) pre-fills the medical
// school from the person's mentor application (#85). Only answers for a
// valid, unused invite code that matches the email in the link.
export async function GET(req: Request) {
  const r = await rateLimit(RATE_LIMITS.invitePrefillPerIpHour, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec);
  const sp = new URL(req.url).searchParams;
  const code = (sp.get("code") || "").trim().toUpperCase().slice(0, 64);
  const email = normalizeEmail(sp.get("email"));
  if (!code || !email) return NextResponse.json({ medicalSchool: null });
  const invite = await prisma.invite.findUnique({ where: { code }, select: { id: true, email: true, status: true, expiresAt: true } });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date() || invite.email.toLowerCase() !== email) {
    return NextResponse.json({ medicalSchool: null });
  }
  return NextResponse.json({ medicalSchool: await applicationSchoolForInvite(invite.id, email) });
}
