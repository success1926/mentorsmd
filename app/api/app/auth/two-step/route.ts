import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appSignInEnabled, readChallenge, startAppSession } from "@/lib/appAuth";
import { checkEmailCode, hasOpenEmailCode, needsTwoStep, sendEmailCode, trustCookieValue } from "@/lib/mfa";
import { decryptSecret, verifyTotp } from "@/lib/totp";
import { logAdminAction } from "@/lib/adminLog";
import { sendTeamAccessChangedEmail } from "@/lib/email";
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

    // First time (an admin who hadn't set up 2-step yet): email codes are
    // now their method, as on the website.
    if (!me.twoFactorMethod) {
      await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: "EMAIL", twoFactorEnabledAt: new Date(), totpSecret: null } });
      if (me.role === "ADMIN") {
        await logAdminAction({
          adminId: me.id,
          action: "TEAM_2FA_SETUP",
          summary: `${me.name} set up 2-step verification (email codes) in the app`,
          targetType: "USER",
          targetId: me.id,
          targetUserId: me.id,
        });
        await sendTeamAccessChangedEmail(
          me.email,
          me.name,
          "2-step verification (email codes) was just set up on your MentorsMD admin account, from the phone app. If this wasn't you, tell the team Owner right away so they can reset it and disable the account."
        ).catch(() => {});
      }
    }

    const tokens = await startAppSession(me, challenge.platform, challenge.deviceName);
    return NextResponse.json({ status: "signed-in", ...tokens, ...(body.trust === true ? { trustToken: trustCookieValue(me.id) } : {}) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
