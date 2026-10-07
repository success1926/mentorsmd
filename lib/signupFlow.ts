import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { MIN_AGE, ADULT_AGE, ageOn, requiredKindsFor } from "@/lib/legalKinds";
import { recordAcceptances } from "@/lib/legal";
import { startParentConsent, type ParentInfo } from "@/lib/minors";
import { logAdminAction } from "@/lib/adminLog";

// Date of birth + agreement for a student account, shared by the email
// signup, the Google signup and the one-time form on the blocking screen.

// ---- Google signup: the answers given on /signup before going to Google ----
// Kept in a short-lived signed cookie, and applied the first time the new
// account loads the blocking screen (components/AccountGate.tsx).
export const SIGNUP_COOKIE = "mmd_signup";
const COOKIE_MINUTES = 30;

type Intent = { dob: string; agreed: true; parent?: ParentInfo; exp: number };

function sign(data: string) {
  return crypto.createHmac("sha256", `${process.env.NEXTAUTH_SECRET || "mentorsmd"}:signup-intent`).update(data).digest("base64url");
}

export function encodeSignupIntent(i: Omit<Intent, "exp">) {
  const data = Buffer.from(JSON.stringify({ ...i, exp: Date.now() + COOKIE_MINUTES * 60_000 })).toString("base64url");
  return { value: `${data}.${sign(data)}`, maxAge: COOKIE_MINUTES * 60 };
}

export function decodeSignupIntent(value: string | undefined | null): Intent | null {
  if (!value) return null;
  const [data, sig] = value.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const i = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!i || i.exp < Date.now() || i.agreed !== true || typeof i.dob !== "string") return null;
    return i as Intent;
  } catch {
    return null;
  }
}

export type AgeResult = { ok: true; minor: boolean; emailSent?: boolean } | { ok: false; under13: true } | { ok: false; error: string };

// Saves the date of birth on an existing student account, records the
// agreements, and starts parental consent for 13-17 year olds. Under 13:
// the account is deleted (or, if it already has activity, removed).
export async function applyDobAndAgreement(
  user: { id: string; email: string; name: string; role: string },
  dob: Date,
  parent: ParentInfo | null,
  context: string,
  meta: { ip: string | null; userAgent: string | null }
): Promise<AgeResult> {
  const age = ageOn(dob);
  if (age < MIN_AGE) {
    await closeUnder13(user.id);
    return { ok: false, under13: true };
  }
  const minor = age < ADULT_AGE;
  if (minor && !parent) return { ok: false, error: "A parent or guardian's details are needed for students under 18" };
  await prisma.user.update({ where: { id: user.id }, data: { dateOfBirth: dob, ...(minor ? { minorStatus: "PENDING" } : {}) } });
  await recordAcceptances(user, requiredKindsFor(user.role), context, meta);
  if (minor && parent) {
    const r = await startParentConsent(user, parent);
    return { ok: true, minor, emailSent: r.emailSent };
  }
  return { ok: true, minor };
}

// Under 13 can't have an account (#106). A brand-new account is deleted
// outright; one that already has orders or messages is removed instead
// (it can't log in again) so its records aren't lost.
async function closeUnder13(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    await prisma.user.update({
      where: { id: userId },
      data: { profileStatus: "REMOVED", removedAt: new Date(), removedReason: "Under 13 (date of birth)", removedByAdmin: true },
    });
    await logAdminAction({ adminId: null, action: "USER_UNDER_13", summary: "Account removed automatically: date of birth is under 13", targetType: "USER", targetId: userId, targetUserId: userId });
  }
}
