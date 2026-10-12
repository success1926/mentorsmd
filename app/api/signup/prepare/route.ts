import { NextResponse } from "next/server";
import { ADULT_AGE, MIN_AGE, UNDER_13_MESSAGE, ageOn, parseDob } from "@/lib/legalKinds";
import { cleanParentInfo } from "@/lib/minors";
import { SIGNUP_COOKIE, encodeSignupIntent } from "@/lib/signupFlow";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

// "Sign up with Google" (#100, #104): the agreement checkbox, date of birth
// and (for 13-17) parent details are checked here first and kept in a
// short-lived signed cookie. They're saved on the new account when it
// first loads (GET /api/me/gate).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await rateLimit(RATE_LIMITS.signupPerIpDay, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec);

  if (body.agreed !== true) {
    return NextResponse.json({ error: "Please agree to the Terms of Service, Privacy Policy and Community Guidelines" }, { status: 400 });
  }
  const dob = parseDob(body.dateOfBirth);
  if (!dob) return NextResponse.json({ error: "Enter your date of birth" }, { status: 400 });
  const age = ageOn(dob);
  if (age < MIN_AGE) return NextResponse.json({ error: UNDER_13_MESSAGE, code: "UNDER_13" }, { status: 400 });
  const parent = age < ADULT_AGE ? cleanParentInfo(body) : null;
  if (parent && "error" in parent) return NextResponse.json({ error: parent.error }, { status: 400 });

  const cookie = encodeSignupIntent({ dob: body.dateOfBirth, agreed: true, ...(parent && !("error" in parent) ? { parent } : {}) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SIGNUP_COOKIE, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  return res;
}
