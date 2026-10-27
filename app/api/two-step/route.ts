import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { checkEmailCode, issueMfaTicket, sendEmailCode, TRUST_DAYS, trustCookieName, trustCookieValue } from "@/lib/mfa";
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { maskEmail, personAwaiting2fa, trustCookieOptions } from "@/lib/twoStep";
import { logAdminAction } from "@/lib/adminLog";
import { sendTeamAccessChangedEmail } from "@/lib/email";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// 2-step verification at login, for everyone who needs it (admins on
// /admin/verify, mentors and students on /two-step). Works for someone who
// has logged in with their password (or Google) but hasn't entered their
// code yet. /api/admin/2fa is the same route under its old address.

export async function GET() {
  const me = await personAwaiting2fa();
  if (!me) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  return NextResponse.json({ method: me.twoFactorMethod, email: maskEmail(me.email), role: me.role });
}

//   { action: "start-app" }              set-up only: new authenticator secret + QR code
//   { action: "send-code" }              email a 6-digit code
//   { action: "verify", method: "TOTP" | "EMAIL", code, trust }
export async function POST(req: Request) {
  const me = await personAwaiting2fa();
  if (!me) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const isAdmin = me.role === "ADMIN";

  if (body.action === "start-app") {
    if (me.twoFactorMethod) {
      return NextResponse.json(
        { error: isAdmin ? "2-step verification is already set up. Ask an Owner to reset it if you need to change it." : "2-step verification is already set up. You can change it in Settings once you're logged in." },
        { status: 400 }
      );
    }
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: me.id }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
    const qr = await QRCode.toDataURL(otpauthUrl(secret, me.email), { margin: 1, width: 220 });
    return NextResponse.json({ secret, qr });
  }

  if (body.action === "send-code") {
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
    if (me.twoFactorMethod === "EMAIL" && method === "TOTP") return NextResponse.json({ error: "Use the code we email you." }, { status: 400 });

    let ok = false;
    if (method === "TOTP") {
      const secret = decryptSecret(me.totpSecret);
      if (!secret) return NextResponse.json({ error: "Set up your authenticator app first." }, { status: 400 });
      const step = verifyTotp(secret, String(body.code || ""), me.totpLastStep);
      if (step !== null) {
        ok = true;
        await prisma.user.update({ where: { id: me.id }, data: { totpLastStep: step } });
      }
    } else {
      ok = await checkEmailCode(me.id, String(body.code || ""));
    }
    if (!ok) return NextResponse.json({ error: "That code isn't right (or has expired). Try again." }, { status: 400 });

    // First time: this is now their method.
    if (!me.twoFactorMethod) {
      const label = method === "TOTP" ? "authenticator app" : "email codes";
      await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: method, twoFactorEnabledAt: new Date(), ...(method === "EMAIL" ? { totpSecret: null } : {}) } });
      if (isAdmin) {
        await logAdminAction({
          adminId: me.id,
          action: "TEAM_2FA_SETUP",
          summary: `${me.name} set up 2-step verification (${label})`,
          targetType: "USER",
          targetId: me.id,
          targetUserId: me.id,
        });
        // A heads-up in case it wasn't them.
        await sendTeamAccessChangedEmail(
          me.email,
          me.name,
          `2-step verification (${label}) was just set up on your MentorsMD admin account. If this wasn't you, tell the team Owner right away so they can reset it and disable the account.`
        ).catch(() => {});
      }
    }

    const res = NextResponse.json({ ticket: await issueMfaTicket(me.id) });
    // "Trust this device for 30 days": this browser skips the code until then.
    if (body.trust === true) res.cookies.set(trustCookieName(me.id), trustCookieValue(me.id), trustCookieOptions(TRUST_DAYS * 86400));
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
