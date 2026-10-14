import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate";
import { isBot } from "@/lib/honeypot";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { clientIp, ipKey } from "@/lib/request";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptcha";
import { SERVICES } from "@/lib/options";
import { isApplyYear } from "@/lib/leadOptions";

// Public: "Tell me when mentors join" (the waitlist box on /mentors).
// One signup per email: signing up again only updates the answers. The
// reply is the same either way, so the form never reveals who's on the list.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (isBot(body)) return NextResponse.json({ ok: true });

  const burst = await rateLimit(RATE_LIMITS.waitlistPerIpHour, ipKey(req));
  if (!burst.ok) return tooMany(burst.retryAfterSec, "Too many signups from this connection. Please try again later.");
  if (!(await verifyRecaptcha(body.recaptchaToken, "waitlist", clientIp(req)))) {
    return NextResponse.json({ error: RECAPTCHA_FAILED }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  const service = typeof body.service === "string" && SERVICES.some((s) => s.value === body.service) ? body.service : null;
  const applyYear = isApplyYear(body.applyYear) ? (body.applyYear as string) : null;
  const source = typeof body.source === "string" && /^[a-z-]{1,20}$/.test(body.source) ? body.source : "mentors";

  const answers = { ...(service ? { service } : {}), ...(applyYear ? { applyYear } : {}) };
  try {
    await prisma.lead.upsert({
      where: { dedupeKey: `waitlist:${email}` },
      create: { kind: "WAITLIST", dedupeKey: `waitlist:${email}`, email, service, applyYear, source, ipHash: ipKey(req) },
      update: answers,
    });
  } catch (err: any) {
    // Two signups for the same email at the same moment: the other one won.
    if (err?.code !== "P2002") {
      console.error("Waitlist signup failed:", err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
