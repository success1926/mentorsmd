import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { adminAwaiting2fa } from "@/lib/adminTeam";
import { checkAdminEmailCode, issueMfaTicket, sendAdminEmailCode } from "@/lib/mfa";
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { logAdminAction } from "@/lib/adminLog";
import { sendTeamAccessChangedEmail } from "@/lib/email";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Required 2-step verification for admins (#116), used by /admin/verify.
// Works for an admin who has logged in with their password but hasn't
// finished this step yet (their session role is "ADMIN_2FA").

function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

export async function GET() {
  const admin = await adminAwaiting2fa();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ method: admin.twoFactorMethod, email: maskEmail(admin.email) });
}

//   { action: "start-app" }              set-up only: new authenticator secret + QR code
//   { action: "send-code" }              email a 6-digit code
//   { action: "verify", method: "TOTP" | "EMAIL", code }
export async function POST(req: Request) {
  const admin = await adminAwaiting2fa();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "start-app") {
    if (admin.twoFactorMethod) return NextResponse.json({ error: "2-step verification is already set up. Ask an Owner to reset it if you need to change it." }, { status: 400 });
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: admin.id }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
    const url = otpauthUrl(secret, admin.email);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    return NextResponse.json({ secret, qr });
  }

  if (body.action === "send-code") {
    const r = await rateLimit(RATE_LIMITS.adminCodePerHour, admin.id);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many codes requested. Please wait a bit and try again.");
    try {
      await sendAdminEmailCode(admin);
    } catch (err) {
      console.error("Couldn't send the admin code email:", err);
      return NextResponse.json({ error: "The email didn't send. Please try again in a minute." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "verify") {
    const r = await rateLimit(RATE_LIMITS.admin2faTries, admin.id);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many wrong codes. Please wait 15 minutes and try again.");
    const method = body.method === "TOTP" ? "TOTP" : "EMAIL";
    if (admin.twoFactorMethod === "EMAIL" && method === "TOTP") return NextResponse.json({ error: "Use the code we email you." }, { status: 400 });

    let ok = false;
    if (method === "TOTP") {
      const secret = decryptSecret(admin.totpSecret);
      if (!secret) return NextResponse.json({ error: "Set up your authenticator app first." }, { status: 400 });
      const step = verifyTotp(secret, String(body.code || ""), admin.totpLastStep);
      if (step !== null) {
        ok = true;
        await prisma.user.update({ where: { id: admin.id }, data: { totpLastStep: step } });
      }
    } else {
      ok = await checkAdminEmailCode(admin.id, String(body.code || ""));
    }
    if (!ok) return NextResponse.json({ error: "That code isn't right (or has expired). Try again." }, { status: 400 });

    // First time: this is now their method.
    if (!admin.twoFactorMethod) {
      await prisma.user.update({ where: { id: admin.id }, data: { twoFactorMethod: method, twoFactorEnabledAt: new Date(), ...(method === "EMAIL" ? { totpSecret: null } : {}) } });
      await logAdminAction({
        adminId: admin.id,
        action: "TEAM_2FA_SETUP",
        summary: `${admin.name} set up 2-step verification (${method === "TOTP" ? "authenticator app" : "email codes"})`,
        targetType: "USER",
        targetId: admin.id,
        targetUserId: admin.id,
      });
      // A heads-up in case it wasn't them.
      await sendTeamAccessChangedEmail(
        admin.email,
        admin.name,
        `2-step verification (${method === "TOTP" ? "authenticator app" : "email codes"}) was just set up on your MentorsMD admin account. If this wasn't you, tell the team Owner right away so they can reset it and disable the account.`
      ).catch(() => {});
    }
    return NextResponse.json({ ticket: await issueMfaTicket(admin.id) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
