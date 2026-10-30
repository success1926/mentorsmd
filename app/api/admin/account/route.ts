import { NextResponse, type NextRequest } from "next/server";
import { encode, getToken } from "next-auth/jwt";
import { currentAdmin, revokeSessions } from "@/lib/adminTeam";
import { forgetTrustedDevices, trustCookieName } from "@/lib/mfa";
import { trustCookieOptions } from "@/lib/twoStep";
import { SESSION_IDLE_SECONDS } from "@/lib/sessionRules";
import { logAdminAction } from "@/lib/adminLog";

export const dynamic = "force-dynamic";

// Admin -> Account & Security (/admin/account): the logged-in admin's own
// account, so any admin may use it (no area permission, unlike the other
// /api/admin routes; currentAdmin() still requires a finished 2-step login).
//   { action: "sign-out-others" }  ends every other login of this account
//   { action: "forget-devices" }   every trusted browser needs a code again
//
// Signing out other devices sets sessionsRevokedAt to now, which ends
// every login that started before it (checked on every admin request in
// the jwt callback, lib/auth.ts, by comparing with the token's
// issuedAtMs). To keep this browser logged in, its own login cookie is
// re-signed with a fresh issuedAtMs (just after the revoke time). If that
// can't be done (cookie missing or split into chunks), this browser is
// signed out too and the reply says so (`signedOut: true`).

// NextAuth's login cookie: the __Secure- name on https, the plain one locally.
const COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

export async function POST(req: NextRequest) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "forget-devices") {
    await forgetTrustedDevices(admin.id);
    await logAdminAction({ adminId: admin.id, action: "ACCOUNT_FORGET_DEVICES", summary: `${admin.name} forgot their trusted devices`, targetType: "USER", targetId: admin.id, targetUserId: admin.id });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(trustCookieName(admin.id), "", trustCookieOptions(0));
    return res;
  }

  if (body.action === "sign-out-others") {
    const secret = process.env.NEXTAUTH_SECRET;
    const cookieName = COOKIE_NAMES.find((n) => req.cookies.has(n));
    const token = cookieName && secret ? await getToken({ req, secret, secureCookie: cookieName.startsWith("__Secure-") }) : null;

    await revokeSessions(admin.id);
    await logAdminAction({ adminId: admin.id, action: "ACCOUNT_SIGN_OUT_OTHERS", summary: `${admin.name} signed out of all their other devices`, targetType: "USER", targetId: admin.id, targetUserId: admin.id });

    if (!token || !cookieName || !secret || token.sub !== admin.id) {
      return NextResponse.json({ ok: true, signedOut: true });
    }
    // A new login cookie for this browser only, issued after the revoke time.
    const fresh = { ...token, issuedAtMs: Date.now() + 1, lastSeenMs: Date.now() };
    const value = await encode({ token: fresh, secret, maxAge: SESSION_IDLE_SECONDS });
    const res = NextResponse.json({ ok: true, signedOut: false });
    res.cookies.set(cookieName, value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookieName.startsWith("__Secure-"),
      maxAge: SESSION_IDLE_SECONDS,
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
