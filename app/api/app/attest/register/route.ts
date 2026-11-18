import { NextResponse } from "next/server";
import { appSignInEnabled } from "@/lib/appAuth";
import { registerAttestKey } from "@/lib/appAttest";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

export const dynamic = "force-dynamic";

// Registers the app's App Attest key, once per install (lib/appAttest.ts).
//   { keyId, attestation (base64), challenge } -> { ok: true }
//   or { error, code } (ATTEST_UNCONFIGURED, ATTEST_REFUSED, ...)
export async function POST(req: Request) {
  if (!appSignInEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await rateLimit(RATE_LIMITS.attestRegisterPerIp, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec, "Too many sign-in attempts. Please wait a bit and try again.");
  const body = await req.json().catch(() => ({}));
  const result = await registerAttestKey(body);
  if ("code" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true });
}
