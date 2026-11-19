import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appSignInEnabled, readChallenge, startAppSession } from "@/lib/appAuth";
import { checkEmailCode, hasOpenEmailCode, needsTwoStep, sendEmailCode, trustCookieValue } from "@/lib/mfa";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// The phone app's 2-step code, after the password (/api/app/auth/login
// answered "needs-code"). The same codes, limits and rules as the
// website's /api/two-step, except that a new authenticator app can't be
// set up here (that's on the website).
//   { challenge, action: "send-code", auto? }       email a 6-digit code
//   { challenge, action: "verify", method: "TOTP" | "EMAIL", code, trust? }
// A right code answers { status: "signed-in", accessToken, refreshToken,
// expiresIn, user, trustToken? }. trustToken (when trust is true) is what
// the app sends with its next sign-in to skip the code for 30 days.
export async function POST(req: Request) {
  if (!appSignInEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const challenge = await readChallenge(body.challenge);
  if (!challenge) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const me = await prisma.user.findUnique({
    where: { id: challenge.userId },
    select: { id: true, name: true, email: true, role: true, removedByAdmin: true, adminDisabledAt: true, twoFactorMethod: true, totpSecret: true, totpLastStep: true },
  });
  if (!me || me.removedByAdmin || me.adminDisabledAt || !needsTwoStep(me)) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  // The app has no admin area: no code, no session, no 2-step setup.
  if (me.role === "ADMIN") return NextResponse.json({ error: "Team accounts use the website.", code: "TEAM_ACCOUNT" }, { status: 403 });

  if (body.action === "send-code") {
    if (body.auto === true && (await hasOpenEmailCode(me.id))) return NextResponse.json({ ok: true, sent: false, earlier: true });
    const r = await rateLimit(RATE_LIMITS.twoStepCodePerHour, me.id);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many codes requested. Please wait a bit and try again.");
    try {
      const sent = await sendEmailCode(me);
      return NextResponse.json({ ok: true, sent });
    } catch (err) {
      console.error("Couldn't send the 2-step code email:", err);
      return NextResponse.json({ error: "The email didn't send. Please try again in a minute." }, { status: 502 });
    }
  }

  if (body.action === "verify") {
    const r = await rateLimit(RATE_LIMITS.twoStepTries, me.id);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many wrong codes. Please wait 15 minutes and try again.");
    const method = body.method === "TOTP" ? "TOTP" : "EMAIL";
    if (method === "TOTP" && me.twoFactorMethod !== "TOTP") return NextResponse.json({ error: "Use the code we email you." }, { status: 400 });

    let ok = false;
    if (method === "TOTP") {
      const secret = decryptSecret(me.totpSecret);
      if (!secret) return NextResponse.json({ error: "Use the code we email you." }, { status: 400 });
      const step = verifyTotp(secret, String(body.code || ""), me.totpLastStep);
      if (step !== null) {
        ok = true;
        await prisma.user.update({ where: { id: me.id }, data: { totpLastStep: step } });
      }
    } else {
      ok = await checkEmailCode(me.id, String(body.code || ""));
    }
    if (!ok) return NextResponse.json({ error: "That code isn't right (or has expired). Try again." }, { status: 400 });

    // First time (2-step was switched on for this account but no method was
    // picked yet): email codes are now their method, as on the website.
    if (!me.twoFactorMethod) {
      await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: "EMAIL", twoFactorEnabledAt: new Date(), totpSecret: null } });
    }

    const tokens = await startAppSession(me, challenge.platform, challenge.deviceName);
    return NextResponse.json({ status: "signed-in", ...tokens, ...(body.trust === true ? { trustToken: trustCookieValue(me.id) } : {}) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
