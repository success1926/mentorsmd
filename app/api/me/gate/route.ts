import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accountGate } from "@/lib/gate";
import { pendingLegal, recordAcceptances, requestMeta } from "@/lib/legal";
import { parseDob } from "@/lib/legalKinds";
import { cleanParentInfo, resendParentConsent, startParentConsent } from "@/lib/minors";
import { SIGNUP_COOKIE, applyDobAndAgreement, decodeSignupIntent } from "@/lib/signupFlow";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

async function me() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, role: true, dateOfBirth: true, minorStatus: true } });
}

// The blocking screen's state (components/AccountGate.tsx). A new Google
// account that came from /signup gets its saved answers applied here.
export async function GET(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let applied: string | null = null;
  const intentCookie = cookies().get(SIGNUP_COOKIE)?.value;
  if (intentCookie && user.role === "BUYER" && !user.dateOfBirth) {
    const intent = decodeSignupIntent(intentCookie);
    const dob = intent ? parseDob(intent.dob) : null;
    if (intent && dob) {
      const r = await applyDobAndAgreement(user, dob, intent.parent || null, "GOOGLE_SIGNUP", requestMeta(req));
      applied = r.ok ? "ok" : "under13" in r ? "under13" : null;
    }
  }
  if (intentCookie) cookies().delete(SIGNUP_COOKIE);
  if (applied === "under13") return NextResponse.json({ under13: true });

  const gate = await accountGate(user.id);
  return NextResponse.json({ gate, role: user.role });
}

// Actions from the blocking screen:
//   { action: "profile", dateOfBirth, agreed, parentName?, parentEmail?, parentPhone? }
//   { action: "accept", kinds: [...] }            accept the updated documents
//   { action: "resend" }                           send the parent's link again
//   { action: "parent", parentName, parentEmail, parentPhone }   new parent details
export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "BUYER" && user.role !== "SELLER") return NextResponse.json({ error: "Nothing to do for this account" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const meta = requestMeta(req);

  if (body.action === "profile") {
    if (user.role !== "BUYER" || user.dateOfBirth) return NextResponse.json({ error: "Your date of birth is already on file" }, { status: 400 });
    if (body.agreed !== true) return NextResponse.json({ error: "Please agree to the Terms of Service, Privacy Policy and Community Guidelines" }, { status: 400 });
    const dob = parseDob(body.dateOfBirth);
    if (!dob) return NextResponse.json({ error: "Enter your date of birth" }, { status: 400 });
    let parent = null;
    if (body.parentName || body.parentEmail || body.parentPhone) {
      const p = cleanParentInfo(body, user.email);
      if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
      parent = p;
    }
    const r = await applyDobAndAgreement(user, dob, parent, "PROFILE_PROMPT", meta);
    if ("under13" in r) return NextResponse.json({ under13: true });
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, gate: await accountGate(user.id) });
  }

  if (body.action === "accept") {
    if (body.agreed !== true) return NextResponse.json({ error: "Please tick the box to accept" }, { status: 400 });
    const pending = await pendingLegal(user);
    await recordAcceptances(user, pending.map((d) => d.kind), "PROMPT", meta);
    return NextResponse.json({ ok: true, gate: await accountGate(user.id) });
  }

  if (body.action === "resend" || body.action === "parent") {
    if (user.role !== "BUYER" || !user.minorStatus || user.minorStatus === "CONSENTED") {
      return NextResponse.json({ error: "Parental consent isn't needed for this account" }, { status: 400 });
    }
    const limit = await rateLimit(RATE_LIMITS.parentConsentPerDay, user.id);
    if (!limit.ok) return tooMany(limit.retryAfterSec, "You've sent several requests today. Please try again tomorrow, or ask your parent or guardian to check their spam folder.");
    if (body.action === "parent") {
      const p = cleanParentInfo(body, user.email);
      if ("error" in p) return NextResponse.json({ error: p.error }, { status: 400 });
      const r = await startParentConsent(user, p);
      return NextResponse.json({ ok: true, emailSent: r.emailSent, gate: await accountGate(user.id) });
    }
    const r = await resendParentConsent(user);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, emailSent: r.emailSent, gate: await accountGate(user.id) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
