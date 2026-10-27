import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { forgetTrustedDevices, trustCookieName } from "@/lib/mfa";
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { maskEmail, memberForTwoStepSettings, trustCookieOptions } from "@/lib/twoStep";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// The "2-step verification" card in Settings (mentors: /dashboard/settings,
// students: /account). Mentors always have it (email codes unless they set
// up an app); students can turn it on and off. Changes apply from the next
// login, so the session they're in keeps working.

export async function GET() {
  const me = await memberForTwoStepSettings();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const required = me.role === "SELLER";
  // A mentor with nothing chosen yet gets email codes.
  const method = me.twoFactorMethod || (required ? "EMAIL" : null);
  return NextResponse.json({ method, required, email: maskEmail(me.email) });
}

//   { action: "use-email" }              turn on / switch to email codes
//   { action: "start-app" }              new authenticator secret + QR code
//   { action: "confirm-app", code }      finish switching to the app
//   { action: "turn-off" }               students only
//   { action: "forget-devices" }         every trusted browser needs a code again
export async function POST(req: Request) {
  const me = await memberForTwoStepSettings();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const required = me.role === "SELLER";

  if (body.action === "use-email") {
    await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: "EMAIL", totpSecret: null, totpLastStep: null, twoFactorEnabledAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "start-app") {
    if (me.twoFactorMethod === "TOTP") return NextResponse.json({ error: "You already use an authenticator app." }, { status: 400 });
    // Saved now, but only used once confirmed: until then their method
    // stays as it was.
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: me.id }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
    const qr = await QRCode.toDataURL(otpauthUrl(secret, me.email), { margin: 1, width: 220 });
    return NextResponse.json({ secret, qr });
  }

  if (body.action === "confirm-app") {
    const r = await rateLimit(RATE_LIMITS.twoStepTries, me.id);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many wrong codes. Please wait 15 minutes and try again.");
    const secret = decryptSecret(me.totpSecret);
    if (!secret) return NextResponse.json({ error: "Start again: press \"Use an authenticator app\"." }, { status: 400 });
    const step = verifyTotp(secret, String(body.code || ""), null);
    if (step === null) return NextResponse.json({ error: "That code isn't right. Check the app and try again." }, { status: 400 });
    await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: "TOTP", totpLastStep: step, twoFactorEnabledAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "turn-off") {
    if (required) return NextResponse.json({ error: "Mentor accounts always use 2-step verification." }, { status: 400 });
    await prisma.user.update({ where: { id: me.id }, data: { twoFactorMethod: null, totpSecret: null, totpLastStep: null, twoFactorEnabledAt: null } });
    await forgetTrustedDevices(me.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "forget-devices") {
    await forgetTrustedDevices(me.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(trustCookieName(me.id), "", trustCookieOptions(0));
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
