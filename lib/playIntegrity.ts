import crypto from "crypto";

// Google Play Integrity for the Android app's sign-in (Nov 2026): the
// Android twin of Apple App Attest (lib/appAttest.ts).
//
// Why: same as App Attest. /api/app/auth/login takes a password from
// anything on the internet, so the phone proves the request comes from the
// real MentorsMD app, installed from Google Play, on a genuine Android
// device. Google signs that verdict; scripts and modified copies can't.
//
// How it works (Play Integrity "standard requests"):
//   1. The app gets a one-time challenge from /api/app/attest/challenge
//      (the answer includes our Google Cloud project number).
//   2. It builds {"challenge","email"} (the same text an iPhone signs),
//      hashes it (SHA-256, hex) and asks Google Play for an integrity token
//      bound to that hash.
//   3. /api/app/auth/login sends the token to Google's decode API with our
//      service account, then checks: our package name, the hash matches
//      this sign-in, the verdict is fresh, the app is the one Play knows
//      (PLAY_RECOGNIZED) and the device passes MEETS_DEVICE_INTEGRITY. The
//      challenge can be used once.
//
// Settings (Vercel, Production):
//   PLAY_INTEGRITY_PROJECT_NUMBER   Google Cloud project number linked to
//                                   the app in Play Console (digits)
//   PLAY_INTEGRITY_SERVICE_ACCOUNT  that project's service account key
//                                   (the JSON file, as-is or base64)
//   PLAY_CERT_SHA256 (optional)     the Play app signing certificate's
//                                   SHA-256, to also pin the signing key
//   APP_ANDROID_ALLOW_UNVERIFIED=1  lets Android sign in WITHOUT this check
//                                   (test installs from a link, which Play
//                                   doesn't recognise). Turn off for launch.

export const androidPackage = () => process.env.APP_ANDROID_PACKAGE || "com.mentorsmd.app";
export const playProjectNumber = () => {
  const n = (process.env.PLAY_INTEGRITY_PROJECT_NUMBER || "").trim();
  return /^\d{5,20}$/.test(n) ? n : "";
};

type ServiceAccount = { client_email: string; private_key: string };
export function serviceAccount(): ServiceAccount | null {
  const raw = (process.env.PLAY_INTEGRITY_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text);
    return typeof j.client_email === "string" && typeof j.private_key === "string" ? { client_email: j.client_email, private_key: j.private_key } : null;
  } catch {
    return null;
  }
}

export const playConfigured = () => !!playProjectNumber() && !!serviceAccount();
export const androidUnverifiedAllowed = () => process.env.APP_ANDROID_ALLOW_UNVERIFIED === "1";

// The request hash the app asks Google to bind into the token.
export const playRequestHash = (clientData: string) => crypto.createHash("sha256").update(clientData, "utf8").digest("hex");

// ---- Google access token (service account, cached ~50 minutes) ----

let cached: { token: string; until: number } | null = null;
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/playintegrity", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64url(sig)}` }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || typeof j.access_token !== "string") throw new Error(`Google token refused (${res.status})`);
  cached = { token: j.access_token, until: Date.now() + 50 * 60_000 };
  return j.access_token;
}

// Tests swap in a fake decoder.
type Decoder = (token: string) => Promise<any>;
let decoder: Decoder | null = null;
export function setPlayDecoderForTests(fake: Decoder | null) {
  decoder = fake;
}

// Google's verdict for a token (tokenPayloadExternal), or throws.
export async function decodePlayToken(token: string): Promise<any> {
  if (decoder) return decoder(token);
  const sa = serviceAccount();
  if (!sa) throw new Error("PLAY_INTEGRITY_SERVICE_ACCOUNT is not set");
  const res = await fetch(`https://playintegrity.googleapis.com/v1/${encodeURIComponent(androidPackage())}:decodeIntegrityToken`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken(sa)}`, "content-type": "application/json" },
    body: JSON.stringify({ integrity_token: token }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.tokenPayloadExternal) throw new Error(`Play Integrity decode refused (${res.status})`);
  return j.tokenPayloadExternal;
}

// ---- The verdict rules (pure, so they're easy to test) ----

export const PLAY_MAX_AGE_MS = 10 * 60_000;

// null = passes; otherwise a short reason (logged, never shown).
export function playVerdictProblem(v: any, expectedHash: string, now = Date.now()): string | null {
  const pkg = androidPackage();
  const req = v?.requestDetails || {};
  if (req.requestPackageName !== pkg) return "package";
  if (req.requestHash !== expectedHash) return "hash";
  const ts = Number(req.timestampMillis);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > PLAY_MAX_AGE_MS) return "stale";
  const app = v?.appIntegrity || {};
  if (app.appRecognitionVerdict !== "PLAY_RECOGNIZED") return "app";
  if (app.packageName !== pkg) return "app-package";
  const pin = (process.env.PLAY_CERT_SHA256 || "").trim();
  if (pin) {
    const norm = (s: string) => s.replace(/[:\s]/g, "").toLowerCase();
    const want = norm(/^[0-9a-f:\s]+$/i.test(pin) ? pin : Buffer.from(pin, "base64url").toString("hex"));
    const got = (Array.isArray(app.certificateSha256Digest) ? app.certificateSha256Digest : []).map((d: string) => Buffer.from(String(d), "base64url").toString("hex"));
    if (!got.includes(want)) return "certificate";
  }
  const device: string[] = Array.isArray(v?.deviceIntegrity?.deviceRecognitionVerdict) ? v.deviceIntegrity.deviceRecognitionVerdict : [];
  if (!device.includes("MEETS_DEVICE_INTEGRITY") && !device.includes("MEETS_STRONG_INTEGRITY")) return "device";
  return null;
}
