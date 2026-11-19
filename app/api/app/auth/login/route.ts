import { NextResponse } from "next/server";
import { checkPassword } from "@/lib/auth";
import { checkLoginAttest } from "@/lib/appAttest";
import { appSignInEnabled, cleanDeviceName, cleanPlatform, makeChallenge, startAppSession } from "@/lib/appAuth";
import { isTrustedDevice, needsTwoStep } from "@/lib/mfa";
import { maskEmail } from "@/lib/twoStep";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

export const dynamic = "force-dynamic";

// The phone app's email-and-password sign-in (lib/appAuth.ts).
//   { email, password, platform: "IOS" | "ANDROID", deviceName?, trustToken?,
//     attest?: { keyId, assertion, clientData } }
// attest is Apple App Attest (lib/appAttest.ts): required for iPhones on
// the live site, checked before the password so scripts can't guess
// passwords here. Refusals answer { error, code } with code ATTEST_*.
// Answers one of:
//   { status: "signed-in", accessToken, refreshToken, expiresIn, user }
//   { status: "needs-code", challenge, method, canUseApp, email }
//     -> send the code to /api/app/auth/two-step with the challenge
// The same password check and limits as the website's login (lib/auth.ts).
export async function POST(req: Request) {
  if (!appSignInEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const platform = cleanPlatform(body.platform);
  if (!platform) return NextResponse.json({ error: "Update the app to sign in." }, { status: 400 });
  const email = typeof body.email === "string" ? body.email.slice(0, 320) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 500) : "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  const ip = ipKey(req);
  const perIp = await rateLimit(RATE_LIMITS.loginPerIp, ip);
  if (!perIp.ok) return tooMany(perIp.retryAfterSec, "Too many sign-in attempts. Please wait a bit and try again.");

  const attest = await checkLoginAttest(platform, email, body.attest);
  if ("code" in attest) return NextResponse.json({ error: attest.error, code: attest.code }, { status: attest.status });

  const user = await checkPassword(email, password, ip);
  if (!user) return NextResponse.json({ error: "That email and password don't match an account." }, { status: 401 });
  // The app has no admin area: refused before any code or session.
  if (user.role === "ADMIN") return NextResponse.json({ error: "Team accounts use the website.", code: "TEAM_ACCOUNT" }, { status: 403 });

  const deviceName = cleanDeviceName(body.deviceName);
  if (needsTwoStep(user) && !(await isTrustedDevice(user.id, typeof body.trustToken === "string" ? body.trustToken : undefined))) {
    return NextResponse.json({
      status: "needs-code",
      challenge: await makeChallenge(user.id, platform, deviceName),
      // Email codes unless an authenticator app is set up (that's done on
      // the website).
      method: user.twoFactorMethod === "TOTP" ? "TOTP" : "EMAIL",
      canUseApp: user.twoFactorMethod === "TOTP",
      email: maskEmail(user.email),
    });
  }

  const tokens = await startAppSession(user, platform, deviceName);
  return NextResponse.json({ status: "signed-in", ...tokens });
}
