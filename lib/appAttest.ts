import crypto from "crypto";
import { decode, encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { androidUnverifiedAllowed, decodePlayToken, playConfigured, playProjectNumber, playRequestHash, playVerdictProblem } from "@/lib/playIntegrity";

// Apple App Attest for the phone app's sign-in (Nov 2026).
//
// Why: /api/app/auth/login takes an email and password from anything on
// the internet. The website's login has reCAPTCHA; the app can't show
// that, so instead the iPhone proves the request comes from the real,
// unmodified MentorsMD app (Apple signs for it). Scripts and bots can't.
//
// How it works:
//   1. Once per install, the app makes a key in the iPhone's Secure Enclave
//      and asks Apple to vouch for it ("attestation"), over a one-time
//      challenge from /api/app/attest/challenge. It sends that to
//      /api/app/attest/register; we check Apple's certificate chain, our
//      Team ID + bundle id and the challenge, then keep the key's public
//      half in "AppAttestKey".
//   2. Every sign-in, the app signs { challenge, email } with that key
//      ("assertion"). /api/app/auth/login checks the signature, that the
//      challenge is fresh and that the counter went up (so a captured
//      sign-in can't be replayed).
// The cryptography is done by node-app-attest (Apple's documented steps).
//
// Android phones use Google Play Integrity instead (lib/playIntegrity.ts).
//
// On the live site (VERCEL_ENV=production) iPhones must pass this, and
// Android phones must pass Play Integrity once it's set up (refused until
// then, unless APP_ANDROID_ALLOW_UNVERIFIED=1 lets test installs in). Previews and
// local development accept sign-ins without it (simulators can't attest),
// but still check an attestation when one is sent.
// Settings (Vercel, Production): APPLE_TEAM_ID (10 characters, from the
// Apple Developer account), optional APP_BUNDLE_ID (default
// com.mentorsmd.app), optional APP_ATTEST_ALLOW_DEV=1 to accept Xcode
// development builds on the live site.

const CHALLENGE_SALT = "mentorsmd-app-attest";
const CHALLENGE_SECONDS = 5 * 60;
const MAX_FIELD = 20_000;

export type AttestPurpose = "register" | "login";

const isProduction = () => process.env.VERCEL_ENV === "production";
export const bundleId = () => process.env.APP_BUNDLE_ID || "com.mentorsmd.app";
export const teamId = () => (process.env.APPLE_TEAM_ID || "").trim();
const allowDev = () => !isProduction() || process.env.APP_ATTEST_ALLOW_DEV === "1";

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set");
  return s;
}

// What a sign-in from this platform needs.
//   required:     must carry a valid assertion
//   optional:     checked if sent, allowed without (previews, local)
//   unavailable:  refused (live Android without Play Integrity settings)
//   unconfigured: refused (live site without APPLE_TEAM_ID)
// Android on the live site: APP_ANDROID_ALLOW_UNVERIFIED=1 makes it
// "optional" (the app then sends nothing), else Play Integrity is required
// once its settings are in, else Android is refused.
export type AttestMode = "required" | "optional" | "unavailable" | "unconfigured";
export function attestMode(platform: string): AttestMode {
  if (!isProduction()) return "optional";
  if (platform === "ANDROID") {
    if (androidUnverifiedAllowed()) return "optional";
    return playConfigured() ? "required" : "unavailable";
  }
  if (platform !== "IOS") return "unavailable";
  return /^[A-Z0-9]{10}$/.test(teamId()) ? "required" : "unconfigured";
}

// ---- One-time challenges (signed and short-lived; nothing stored) ----

export async function makeAttestChallenge(purpose: AttestPurpose) {
  return encode({ token: { purpose: `attest-${purpose}`, n: crypto.randomBytes(16).toString("base64url") }, secret: secret(), salt: CHALLENGE_SALT, maxAge: CHALLENGE_SECONDS });
}

export async function checkAttestChallenge(raw: unknown, purpose: AttestPurpose): Promise<boolean> {
  if (typeof raw !== "string" || !raw || raw.length > 2000) return false;
  try {
    const t = await decode({ token: raw, secret: secret(), salt: CHALLENGE_SALT });
    return !!t && t.purpose === `attest-${purpose}` && typeof t.n === "string";
  } catch {
    return false;
  }
}

// ---- What the app signs at sign-in ----

// The exact text the app signs: {"challenge":"...","email":"..."}. Tying
// the email in means a signature can't be reused for another account.
export function loginClientData(challenge: string, email: string) {
  return JSON.stringify({ challenge, email: email.trim().toLowerCase() });
}

export function parseLoginClientData(raw: unknown): { challenge: string; email: string } | null {
  if (typeof raw !== "string" || !raw || raw.length > 4000) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d.challenge !== "string" || typeof d.email !== "string") return null;
    return { challenge: d.challenge, email: d.email };
  } catch {
    return null;
  }
}

const b64 = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length < MAX_FIELD && /^[A-Za-z0-9+/=_-]+$/.test(v) ? Buffer.from(v, "base64") : null);
const cleanKeyId = (v: unknown) => (typeof v === "string" && v.length > 10 && v.length < 200 && /^[A-Za-z0-9+/=]+$/.test(v) ? v : null);

// The crypto library is ESM-only, so it's loaded when first needed.
type Lib = typeof import("node-app-attest");
let lib: Promise<Lib> | null = null;
const attestLib = () => (lib ||= import("node-app-attest"));
// Tests swap in a fake.
export function setAttestLibForTests(fake: Lib | null) {
  lib = fake ? Promise.resolve(fake) : null;
}

export type AttestFail = { ok: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): AttestFail => ({ ok: false, status, code, error });
const UPDATE = "Please update the MentorsMD app and try again.";
const ANDROID_NOT_YET = "The MentorsMD app isn't available on Android yet. Please use mentorsmd.com.";

// ---- 1. Registering a new key (once per install) ----

export async function registerAttestKey(body: any): Promise<{ ok: true } | AttestFail> {
  // Without a Team ID nothing can match Apple's app id. The live site
  // then refuses app sign-in altogether; previews just sign in without.
  if (!teamId()) return fail(503, "ATTEST_UNCONFIGURED", "App sign-in isn't set up yet. Please use the website for now.");
  const keyId = cleanKeyId(body?.keyId);
  const attestation = b64(body?.attestation);
  if (!keyId || !attestation) return fail(400, "ATTEST_BAD_REQUEST", UPDATE);
  if (!(await checkAttestChallenge(body?.challenge, "register"))) return fail(400, "ATTEST_CHALLENGE", "That took too long. Please try again.");

  let publicKey: string;
  let environment: string;
  try {
    const { verifyAttestation } = await attestLib();
    const r = verifyAttestation({
      attestation,
      challenge: body.challenge,
      keyId,
      bundleIdentifier: bundleId(),
      teamIdentifier: teamId(),
      allowDevelopmentEnvironment: allowDev(),
    });
    publicKey = r.publicKey;
    environment = r.environment || "unknown";
  } catch (err) {
    console.warn("App Attest: attestation refused:", (err as Error)?.message);
    return fail(403, "ATTEST_REFUSED", "This copy of the app couldn't be verified. Please install MentorsMD from the App Store.");
  }

  // A key id is Apple's hash of the key, so it can only be registered once.
  try {
    await prisma.appAttestKey.create({ data: { keyId, publicKey, environment, signCount: 0 } });
  } catch {
    const existing = await prisma.appAttestKey.findUnique({ where: { keyId }, select: { publicKey: true } });
    if (!existing || existing.publicKey !== publicKey) return fail(409, "ATTEST_DUPLICATE", UPDATE);
  }
  return { ok: true };
}

// ---- 2. Checking a sign-in ----

export async function checkLoginAttest(platform: string, email: string, attest: any): Promise<{ ok: true; keyId: string | null } | AttestFail> {
  const mode = attestMode(platform);
  if (mode === "unavailable") return fail(403, "ATTEST_PLATFORM", ANDROID_NOT_YET);
  if (mode === "unconfigured") return fail(503, "ATTEST_UNCONFIGURED", "App sign-in isn't set up yet. Please use the website for now.");
  if (!attest) return mode === "required" ? fail(403, "ATTEST_MISSING", UPDATE) : { ok: true, keyId: null };
  if (platform === "ANDROID") return checkPlayLogin(email, attest);
  // A preview with no Team ID can't check anything: let it through.
  if (mode === "optional" && !teamId()) return { ok: true, keyId: null };

  const keyId = cleanKeyId(attest.keyId);
  const assertion = b64(attest.assertion);
  const data = parseLoginClientData(attest.clientData);
  if (!keyId || !assertion || !data) return fail(400, "ATTEST_BAD_REQUEST", UPDATE);
  if (data.email !== email.trim().toLowerCase()) return fail(400, "ATTEST_BAD_REQUEST", UPDATE);
  if (!(await checkAttestChallenge(data.challenge, "login"))) return fail(400, "ATTEST_CHALLENGE", "That took too long. Please try again.");

  const key = await prisma.appAttestKey.findUnique({ where: { keyId } });
  // Unknown key (e.g. the database was reset, or the app was reinstalled):
  // the app makes and registers a new key, then tries once more.
  if (!key || key.revokedAt) return fail(401, "ATTEST_UNKNOWN_KEY", UPDATE);

  let signCount: number;
  try {
    const { verifyAssertion } = await attestLib();
    signCount = verifyAssertion({
      assertion,
      payload: attest.clientData,
      publicKey: key.publicKey,
      bundleIdentifier: bundleId(),
      teamIdentifier: teamId(),
      signCount: key.signCount,
    }).signCount;
  } catch (err) {
    console.warn("App Attest: assertion refused:", (err as Error)?.message);
    return fail(403, "ATTEST_REFUSED", "This copy of the app couldn't be verified. Please install MentorsMD from the App Store.");
  }

  // Only move the counter forward from the value we checked against, so two
  // sign-ins racing with one signature can't both pass.
  const moved = await prisma.appAttestKey.updateMany({ where: { keyId, signCount: key.signCount }, data: { signCount, lastUsedAt: new Date() } });
  if (moved.count !== 1) return fail(403, "ATTEST_REFUSED", "Please try signing in again.");
  return { ok: true, keyId };
}

// ---- Android: Google Play Integrity at sign-in ----

// Marks a challenge used (a row in RateLimitBucket that the usual clean-up
// removes after it expires). False if it was used before.
async function useChallengeOnce(challenge: string): Promise<boolean> {
  const key = `play-once:${crypto.createHash("sha256").update(challenge).digest("hex")}`;
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(Date.now() + 15 * 60_000)})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key"`;
  return rows.length === 1;
}
const INSTALL_FROM_PLAY = "This copy of the app couldn't be verified. Please install MentorsMD from Google Play.";

async function checkPlayLogin(email: string, attest: any): Promise<{ ok: true; keyId: null } | AttestFail> {
  // Without Play settings nothing can be checked. Only reached when Android
  // is let in anyway (a preview, or APP_ANDROID_ALLOW_UNVERIFIED=1).
  if (!playConfigured()) return { ok: true, keyId: null };
  const token = typeof attest?.token === "string" && attest.token.length > 20 && attest.token.length < MAX_FIELD ? attest.token : null;
  const data = parseLoginClientData(attest?.clientData);
  if (attest?.kind !== "play" || !token || !data) return fail(400, "ATTEST_BAD_REQUEST", UPDATE);
  if (data.email !== email.trim().toLowerCase()) return fail(400, "ATTEST_BAD_REQUEST", UPDATE);
  if (!(await checkAttestChallenge(data.challenge, "login"))) return fail(400, "ATTEST_CHALLENGE", "That took too long. Please try again.");

  let verdict: any;
  try {
    verdict = await decodePlayToken(token);
  } catch (err) {
    console.warn("Play Integrity: decode failed:", (err as Error)?.message);
    return fail(503, "ATTEST_UNAVAILABLE", "Couldn't check this phone with Google. Please try again in a minute.");
  }
  const problem = playVerdictProblem(verdict, playRequestHash(attest.clientData));
  if (problem) {
    console.warn("Play Integrity: verdict refused:", problem);
    return fail(403, "ATTEST_REFUSED", INSTALL_FROM_PLAY);
  }
  // Each challenge signs in once, so a captured token can't be replayed.
  if (!(await useChallengeOnce(data.challenge))) return fail(403, "ATTEST_REFUSED", "Please try signing in again.");
  return { ok: true, keyId: null };
}

// What the app needs to know before signing in on this platform: null, or
// the Google Cloud project number when Play Integrity is required.
export function playSetupFor(platform: string): { projectNumber: string } | null {
  if (platform !== "ANDROID" || attestMode("ANDROID") !== "required") return null;
  return { projectNumber: playProjectNumber() };
}
