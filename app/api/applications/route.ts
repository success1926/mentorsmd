import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, isOurBlobUrl } from "@/lib/validate";
import { sendApplicationEmail, sendApplicationReceivedEmail, SITE_URL } from "@/lib/email";
import {
  APPLICATION_LIMITS as L,
  BLURB_MAX_WORDS,
  BLURB_MIN_WORDS,
  HONEYPOT_FIELD,
  RESUME_MAX_BYTES,
  countWords,
  resumeExtension,
} from "@/lib/applicationRules";
import { applicationLimitError, ipHashFor } from "@/lib/applications";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { clientIp, ipKey } from "@/lib/request";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptcha";

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t && t.length <= max ? t : null;
}

// Public: the "Apply to mentor" form at /become-a-mentor/apply. Saves the
// application, emails it to the MentorsMD team (resume attached, reply-to
// the applicant) and sends the applicant a confirmation.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Honeypot: a hidden field only bots fill in. Pretend it worked so the
  // bot doesn't learn anything, but save and send nothing.
  if (body[HONEYPOT_FIELD]) return NextResponse.json({ ok: true });

  const burst = await rateLimit(RATE_LIMITS.applicationsPerIpHour, ipKey(req));
  if (!burst.ok) return tooMany(burst.retryAfterSec, "Too many applications from this connection. Please try again later.");
  if (!(await verifyRecaptcha(body.recaptchaToken, "mentor_application", clientIp(req)))) {
    return NextResponse.json({ error: RECAPTCHA_FAILED }, { status: 400 });
  }

  const name = text(body.name, L.name);
  const email = normalizeEmail(body.email);
  const phone = text(body.phone, L.phone);
  const medicalSchool = text(body.medicalSchool, L.medicalSchool);
  const residency = typeof body.residency === "string" && body.residency.trim() ? text(body.residency, L.residency) : null;
  const blurb = text(body.blurb, L.blurbChars);
  const resumeUrl = body.resumeUrl;
  const resumeName = text(body.resumeName, 150) || "resume";

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!phone || !/^[+()\d\s.-]{7,30}$/.test(phone)) return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  if (!medicalSchool) return NextResponse.json({ error: "Please enter your medical school." }, { status: 400 });
  if (typeof body.residency === "string" && body.residency.trim() && !residency) {
    return NextResponse.json({ error: "Residency is too long." }, { status: 400 });
  }
  const words = blurb ? countWords(blurb) : 0;
  if (!blurb || words < BLURB_MIN_WORDS || words > BLURB_MAX_WORDS) {
    return NextResponse.json({ error: `Tell us about yourself in ${BLURB_MIN_WORDS} to ${BLURB_MAX_WORDS} words.` }, { status: 400 });
  }

  // The resume must be a file uploaded through /api/applications/resume.
  if (!isOurBlobUrl(resumeUrl) || !new URL(resumeUrl).pathname.startsWith("/applications/") || !resumeExtension(new URL(resumeUrl).pathname)) {
    return NextResponse.json({ error: "Please upload your resume (PDF or Word)." }, { status: 400 });
  }

  const ipHash = ipHashFor(req);
  const limit = await applicationLimitError(ipHash, email);
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  // Double-check the size with Blob itself, then read the file so it can
  // be attached to the email. If anything goes wrong reading it, the
  // email still goes out with a link to the resume.
  let attachment: { filename: string; content: Buffer } | undefined;
  try {
    const info = await head(resumeUrl);
    if (info.size > RESUME_MAX_BYTES) {
      return NextResponse.json({ error: "Your resume is larger than 5MB." }, { status: 400 });
    }
    const res = await fetch(resumeUrl);
    if (res.ok) attachment = { filename: resumeName, content: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    console.error("Couldn't read the resume for the application email:", err);
  }

  const application = await prisma.mentorApplication.create({
    data: { name, email, phone, medicalSchool, residency, blurb, resumeUrl, resumeName, ipHash },
  });

  try {
    await sendApplicationEmail(application, `${SITE_URL}/admin#applications`, attachment);
  } catch (err) {
    console.error("Failed to send the application email to the team:", err);
    // Fall back to a link if the attachment was the problem.
    if (attachment) {
      await sendApplicationEmail(application, `${SITE_URL}/admin#applications`).catch((e) => console.error("Retry without attachment failed:", e));
    }
  }
  try {
    await sendApplicationReceivedEmail(email, name);
  } catch (err) {
    console.error("Failed to send the application confirmation:", err);
  }

  return NextResponse.json({ ok: true });
}
