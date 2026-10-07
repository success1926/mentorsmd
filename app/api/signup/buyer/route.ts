import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LIMITS, isNonEmptyString, normalizeEmail } from "@/lib/validate";
import { isValidTimeZone } from "@/lib/tz";
import { isBot } from "@/lib/honeypot";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { clientIp, ipKey } from "@/lib/request";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptcha";
import { RESERVED_NAME_ERROR, isReservedName } from "@/lib/reservedNames";
import { sendVerificationLink } from "@/lib/emailVerification";
import { ADULT_AGE, MIN_AGE, UNDER_13_MESSAGE, ageOn, parseDob, requiredKindsFor } from "@/lib/legalKinds";
import { recordAcceptances, requestMeta } from "@/lib/legal";
import { cleanParentInfo, startParentConsent } from "@/lib/minors";

// Students can sign up freely; this route is protected against bots by a
// hidden trap field, reCAPTCHA and per-IP limits. A "confirm your email"
// link goes out right away (needed before the first message).
// Phase 5: the agreement checkbox and date of birth are required. Under 13
// can't sign up; 13-17 give a parent or guardian, whose consent is needed
// before the account can message or book.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email: rawEmail, password, name, timeZone } = body;

  // Bot filled in the hidden field: pretend it worked, create nothing.
  if (isBot(body)) return NextResponse.json({ ok: true });

  const ip = ipKey(req);
  for (const limit of [RATE_LIMITS.signupPerIpHour, RATE_LIMITS.signupPerIpDay]) {
    const r = await rateLimit(limit, ip);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many accounts were created from this connection. Please try again later.");
  }
  if (!(await verifyRecaptcha(body.recaptchaToken, "signup", clientIp(req)))) {
    return NextResponse.json({ error: RECAPTCHA_FAILED }, { status: 400 });
  }

  // Emails are stored lowercase so "Jane@x.com" and "jane@x.com" can't
  // become two separate accounts (and login matches either spelling).
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (!isNonEmptyString(name, LIMITS.name)) {
    return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  }
  if (isReservedName(name)) return NextResponse.json({ error: RESERVED_NAME_ERROR }, { status: 400 });
  if (typeof password !== "string" || password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (body.agreed !== true) {
    return NextResponse.json({ error: "Please agree to the Terms of Service, Privacy Policy and Community Guidelines" }, { status: 400 });
  }
  const dob = parseDob(body.dateOfBirth);
  if (!dob) return NextResponse.json({ error: "Enter your date of birth" }, { status: 400 });
  const age = ageOn(dob);
  if (age < MIN_AGE) return NextResponse.json({ error: UNDER_13_MESSAGE, code: "UNDER_13" }, { status: 400 });
  const minor = age < ADULT_AGE;
  const parent = minor ? cleanParentInfo(body, email) : null;
  if (parent && "error" in parent) return NextResponse.json({ error: parent.error }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email, name: name.trim(), passwordHash, role: "BUYER", timeZone: isValidTimeZone(timeZone) ? timeZone : null,
        dateOfBirth: dob,
        minorStatus: minor ? "PENDING" : null,
      },
    });
    await recordAcceptances(user, requiredKindsFor("BUYER"), "SIGNUP", requestMeta(req)).catch((err) => console.error("Couldn't record the signup agreement:", err));
    if (parent && !("error" in parent)) await startParentConsent(user, parent);
    try {
      await sendVerificationLink(user);
    } catch (err) {
      console.error("Couldn't send the confirm-your-email link:", err);
    }
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, minor });
  } catch (err) {
    // Two signups for the same email at the same instant.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
    }
    throw err;
  }
}
