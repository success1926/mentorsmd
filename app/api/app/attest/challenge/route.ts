import { NextResponse } from "next/server";
import { appSignInEnabled } from "@/lib/appAuth";
import { makeAttestChallenge } from "@/lib/appAttest";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

export const dynamic = "force-dynamic";

// A one-time challenge for Apple App Attest (lib/appAttest.ts).
//   { purpose: "register" | "login" } -> { challenge } (works for 5 minutes)
export async function POST(req: Request) {
  if (!appSignInEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await rateLimit(RATE_LIMITS.attestChallengePerIp, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec, "Too many sign-in attempts. Please wait a bit and try again.");
  const body = await req.json().catch(() => ({}));
  const purpose = body.purpose === "register" ? "register" : body.purpose === "login" ? "login" : null;
  if (!purpose) return NextResponse.json({ error: "Update the app to sign in." }, { status: 400 });
  return NextResponse.json({ challenge: await makeAttestChallenge(purpose) });
}
