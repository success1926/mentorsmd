// Checks for the phone app's App Attest sign-in check (lib/appAttest.ts).
// Run:  npx -y tsx --test scripts/app-attest.test.ts
// No database is touched: prisma.appAttestKey is replaced by an in-memory
// table below.
//
// The real-crypto checks use genuine Apple attestations and an assertion
// from the node-app-attest project's tests (MIT licence, (c) David
// Übelacker): scripts/app-attest-fixtures/. Those were made for that
// project's app (team V8H6LQ9448, bundle io.uebelacker.AppAttestExample),
// so the checks run with those values. Their challenges are stored as
// base64 (our app and server both use the challenge text itself).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

process.env.NEXTAUTH_SECRET = "test-secret-for-app-attest-checks-only";

const FIX = path.join(__dirname, "app-attest-fixtures");
const prod = JSON.parse(readFileSync(path.join(FIX, "attestation-production.json"), "utf8"));
const dev = JSON.parse(readFileSync(path.join(FIX, "attestation-development.json"), "utf8"));
const EX_TEAM = "V8H6LQ9448";
const EX_BUNDLE = "io.uebelacker.AppAttestExample";
const EX_ASSERTION =
  "omlzaWduYXR1cmVYRzBFAiBB8BGAwkmFCg1M5J0mOYEun0SUN1/lse79/7ypG9WiMQIhAIHvqj7eg59B1PMFX1CN4GMGlsgfFtdL30pHCf7G/dNRcWF1dGhlbnRpY2F0b3JEYXRhWCXKPdw7T3iujcFZbHVrHX0mDSMrNms5PzEbrFbQPRA6rEAAAAAB";
const EX_PUBLIC_KEY =
  "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEg69t2YzgcPTLUx8Zgu+rbcikeaEL\n8Ppb+HG0QTIulz8YUB9tgv1pDRruWk87nZC3our56pzIWaqXEbaWyamdzA==\n-----END PUBLIC KEY-----\n";
const EX_PAYLOAD = '{"subject":"Lorem ipsum","message":"Lorem ipsum dolor sit amet, consectetur adipiscing elit."}';

function setEnv(env: Record<string, string | undefined>) {
  for (const k of ["VERCEL_ENV", "APPLE_TEAM_ID", "APP_BUNDLE_ID", "APP_ATTEST_ALLOW_DEV", "PLAY_INTEGRITY_PROJECT_NUMBER", "PLAY_INTEGRITY_SERVICE_ACCOUNT", "PLAY_CERT_SHA256", "APP_ANDROID_ALLOW_UNVERIFIED"]) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
}

// An in-memory AppAttestKey table in place of the database.
type Row = { keyId: string; publicKey: string; signCount: number; environment: string; revokedAt: Date | null; lastUsedAt?: Date };
async function load() {
  const { prisma } = await import("../lib/prisma");
  const mod = await import("../lib/appAttest");
  const rows = new Map<string, Row>();
  (prisma as any).appAttestKey = {
    create: async ({ data }: any) => {
      if (rows.has(data.keyId)) throw new Error("unique");
      rows.set(data.keyId, { revokedAt: null, ...data });
      return data;
    },
    findUnique: async ({ where }: any) => rows.get(where.keyId) || null,
    updateMany: async ({ where, data }: any) => {
      const r = rows.get(where.keyId);
      if (!r || r.signCount !== where.signCount) return { count: 0 };
      Object.assign(r, data);
      return { count: 1 };
    },
  };
  return { ...mod, rows };
}

// ---------- Real Apple data through node-app-attest ----------

test("a genuine App Store attestation verifies with the right team and bundle", async () => {
  const { verifyAttestation } = await import("node-app-attest");
  const r = verifyAttestation({ attestation: Buffer.from(prod.attestation, "base64"), challenge: Buffer.from(prod.challenge, "base64"), keyId: prod.keyId, bundleIdentifier: EX_BUNDLE, teamIdentifier: EX_TEAM, allowDevelopmentEnvironment: false });
  assert.equal(r.keyId, prod.keyId);
  assert.match(r.publicKey, /BEGIN PUBLIC KEY/);
});

test("the same attestation is refused for MentorsMD's bundle (another app's key can't be used)", async () => {
  const { verifyAttestation } = await import("node-app-attest");
  assert.throws(() => verifyAttestation({ attestation: Buffer.from(prod.attestation, "base64"), challenge: Buffer.from(prod.challenge, "base64"), keyId: prod.keyId, bundleIdentifier: "com.mentorsmd.app", teamIdentifier: EX_TEAM, allowDevelopmentEnvironment: false }));
});

test("a genuine attestation is refused with the wrong challenge", async () => {
  const { verifyAttestation } = await import("node-app-attest");
  assert.throws(() => verifyAttestation({ attestation: Buffer.from(prod.attestation, "base64"), challenge: "some-other-challenge", keyId: prod.keyId, bundleIdentifier: EX_BUNDLE, teamIdentifier: EX_TEAM, allowDevelopmentEnvironment: false }));
});

test("an Xcode development attestation is refused unless development builds are allowed", async () => {
  const { verifyAttestation } = await import("node-app-attest");
  const args = { attestation: Buffer.from(dev.attestation, "base64"), challenge: Buffer.from(dev.challenge, "base64"), keyId: dev.keyId, bundleIdentifier: EX_BUNDLE, teamIdentifier: EX_TEAM };
  assert.throws(() => verifyAttestation({ ...args, allowDevelopmentEnvironment: false }));
  assert.equal(verifyAttestation({ ...args, allowDevelopmentEnvironment: true }).environment, "development");
});

test("a genuine assertion verifies once and its counter can't be replayed", async () => {
  const { verifyAssertion } = await import("node-app-attest");
  const args = { assertion: Buffer.from(EX_ASSERTION, "base64"), payload: EX_PAYLOAD, publicKey: EX_PUBLIC_KEY, bundleIdentifier: EX_BUNDLE, teamIdentifier: EX_TEAM };
  assert.equal(verifyAssertion({ ...args, signCount: 0 }).signCount, 1);
  assert.throws(() => verifyAssertion({ ...args, signCount: 1 }), /signCount/);
  assert.throws(() => verifyAssertion({ ...args, payload: EX_PAYLOAD + " ", signCount: 0 }));
});

// ---------- Our rules (lib/appAttest.ts), with a stand-in for the crypto ----------

// Pretends Apple signed: attestation "good" passes, assertion "c<n>" means counter n.
const fakeLib: any = {
  verifyAttestation: ({ attestation, keyId }: any) => {
    if (attestation.toString() !== "good") throw new Error("bad attestation");
    return { keyId, publicKey: `PK-${keyId}`, environment: "production" };
  },
  verifyAssertion: ({ assertion, publicKey, signCount }: any) => {
    const m = /^c(\d+)$/.exec(assertion.toString());
    if (!m || !publicKey.startsWith("PK-")) throw new Error("bad assertion");
    const next = Number(m[1]);
    if (next <= signCount) throw new Error("invalid signCount");
    return { signCount: next };
  },
};
const enc = (s: string) => Buffer.from(s).toString("base64");
const KEY = "a2V5LWlkLWZvci10ZXN0cw==";

test("the live site requires the check for iPhones, refuses Android (no Play settings), and refuses without a Team ID", async () => {
  const m = await load();
  m.setAttestLibForTests(fakeLib);
  setEnv({ VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345" });
  assert.equal(m.attestMode("IOS"), "required");
  assert.equal(m.attestMode("ANDROID"), "unavailable");
  const none = await m.checkLoginAttest("IOS", "a@b.com", undefined);
  assert.equal("code" in none && none.code, "ATTEST_MISSING");
  const android = await m.checkLoginAttest("ANDROID", "a@b.com", undefined);
  assert.equal("code" in android && android.code, "ATTEST_PLATFORM");
  setEnv({ VERCEL_ENV: "production" });
  assert.equal(m.attestMode("IOS"), "unconfigured");
  const unset = await m.checkLoginAttest("IOS", "a@b.com", undefined);
  assert.equal("code" in unset && unset.code, "ATTEST_UNCONFIGURED");
});

test("previews let sign-in through without the check (simulators can't attest)", async () => {
  const m = await load();
  setEnv({ VERCEL_ENV: "preview" });
  assert.deepEqual(await m.checkLoginAttest("IOS", "a@b.com", undefined), { ok: true, keyId: null });
  assert.deepEqual(await m.checkLoginAttest("ANDROID", "a@b.com", undefined), { ok: true, keyId: null });
});

test("register, then sign in; a replayed or raced signature is refused", async () => {
  const m = await load();
  m.setAttestLibForTests(fakeLib);
  setEnv({ VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345" });

  const regChallenge = await m.makeAttestChallenge("register");
  const reg = await m.registerAttestKey({ keyId: KEY, attestation: enc("good"), challenge: regChallenge });
  assert.deepEqual(reg, { ok: true });
  assert.equal(m.rows.get(KEY)?.signCount, 0);

  const bad = await m.registerAttestKey({ keyId: "b3RoZXIta2V5LWlk", attestation: enc("forged"), challenge: await m.makeAttestChallenge("register") });
  assert.equal("code" in bad && bad.code, "ATTEST_REFUSED");

  const login = async (assertion: string, email = "Priya@Example.com", signedEmail = email) => {
    const clientData = m.loginClientData(await m.makeAttestChallenge("login"), signedEmail);
    return m.checkLoginAttest("IOS", email, { keyId: KEY, assertion: enc(assertion), clientData });
  };
  assert.deepEqual(await login("c1"), { ok: true, keyId: KEY });
  assert.equal(m.rows.get(KEY)?.signCount, 1);
  const replay = await login("c1");
  assert.equal("code" in replay && replay.code, "ATTEST_REFUSED");
  assert.deepEqual(await login("c2"), { ok: true, keyId: KEY });

  // Signed for one email, used for another.
  const swapped = await login("c3", "someone@else.com", "priya@example.com");
  assert.equal("code" in swapped && swapped.code, "ATTEST_BAD_REQUEST");
});

test("challenges only work for their own purpose and can't be made up", async () => {
  const m = await load();
  m.setAttestLibForTests(fakeLib);
  setEnv({ VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345" });
  const reg = await m.makeAttestChallenge("register");
  assert.equal(await m.checkAttestChallenge(reg, "register"), true);
  assert.equal(await m.checkAttestChallenge(reg, "login"), false);
  assert.equal(await m.checkAttestChallenge("made-up", "login"), false);
  // A registration challenge can't be used to sign in.
  await m.registerAttestKey({ keyId: KEY, attestation: enc("good"), challenge: reg });
  const r = await m.checkLoginAttest("IOS", "a@b.com", { keyId: KEY, assertion: enc("c1"), clientData: m.loginClientData(reg, "a@b.com") });
  assert.equal("code" in r && r.code, "ATTEST_CHALLENGE");
});

test("an unknown key asks the app to register a new one", async () => {
  const m = await load();
  m.setAttestLibForTests(fakeLib);
  setEnv({ VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345" });
  const r = await m.checkLoginAttest("IOS", "a@b.com", { keyId: "bmV2ZXItcmVnaXN0ZXJlZA==", assertion: enc("c1"), clientData: m.loginClientData(await m.makeAttestChallenge("login"), "a@b.com") });
  assert.equal("code" in r && r.code, "ATTEST_UNKNOWN_KEY");
});

// ---------- Android: Google Play Integrity ----------

const SA = JSON.stringify({ client_email: "play@example.iam.gserviceaccount.com", private_key: "unused-in-tests" });
const PLAY_ENV = { VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345", PLAY_INTEGRITY_PROJECT_NUMBER: "123456789012", PLAY_INTEGRITY_SERVICE_ACCOUNT: SA };

// What Google returns for the real app on a real phone, bound to `hash`.
function goodVerdict(hash: string, over: any = {}) {
  return {
    requestDetails: { requestPackageName: "com.mentorsmd.app", requestHash: hash, timestampMillis: String(Date.now()), ...over.requestDetails },
    appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED", packageName: "com.mentorsmd.app", certificateSha256Digest: ["6a6a1474b5cbbb2b1aa57e0bc3"], ...over.appIntegrity },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"], ...over.deviceIntegrity },
  };
}

// RateLimitBucket in memory (used challenges).
function fakeBuckets(prisma: any) {
  const used = new Set<string>();
  prisma.$queryRaw = async (strings: TemplateStringsArray, ...vals: any[]) => {
    assert.match(strings.join("?"), /ON CONFLICT \("key"\) DO NOTHING/);
    const key = vals[0];
    if (used.has(key)) return [];
    used.add(key);
    return [{ key }];
  };
}

async function loadPlay(verdictFor: (token: string) => any) {
  const m = await load();
  const play = await import("../lib/playIntegrity");
  const { prisma } = await import("../lib/prisma");
  fakeBuckets(prisma);
  play.setPlayDecoderForTests(async (t) => {
    const v = verdictFor(t);
    if (v instanceof Error) throw v;
    return v;
  });
  return { m, play };
}

test("live Android: refused until Play Integrity is set up, required once it is, and the test switch lets it in", async () => {
  const m = await load();
  setEnv({ VERCEL_ENV: "production", APPLE_TEAM_ID: "ABCDE12345" });
  assert.equal(m.attestMode("ANDROID"), "unavailable");
  assert.equal(m.playSetupFor("ANDROID"), null);
  setEnv({ ...PLAY_ENV });
  assert.equal(m.attestMode("ANDROID"), "required");
  assert.deepEqual(m.playSetupFor("ANDROID"), { projectNumber: "123456789012" });
  assert.equal(m.playSetupFor("IOS"), null);
  const missing = await m.checkLoginAttest("ANDROID", "a@b.com", undefined);
  assert.equal("code" in missing && missing.code, "ATTEST_MISSING");
  // Test installs from a link: allowed without a token, and not asked for one.
  setEnv({ ...PLAY_ENV, APP_ANDROID_ALLOW_UNVERIFIED: "1" });
  assert.equal(m.attestMode("ANDROID"), "optional");
  assert.equal(m.playSetupFor("ANDROID"), null);
  assert.deepEqual(await m.checkLoginAttest("ANDROID", "a@b.com", undefined), { ok: true, keyId: null });
  setEnv({ VERCEL_ENV: "production", APP_ANDROID_ALLOW_UNVERIFIED: "1" });
  assert.deepEqual(await m.checkLoginAttest("ANDROID", "a@b.com", undefined), { ok: true, keyId: null });
  // The switch never relaxes iPhones.
  assert.equal(m.attestMode("IOS"), "unconfigured");
});

test("a genuine Play verdict signs in once; the same challenge can't be used again", async () => {
  setEnv({ ...PLAY_ENV });
  const { m, play } = await loadPlay((t) => JSON.parse(t));
  const clientData = m.loginClientData(await m.makeAttestChallenge("login"), "Jane@Example.com");
  const token = JSON.stringify(goodVerdict(play.playRequestHash(clientData)));
  const first = await m.checkLoginAttest("ANDROID", "jane@example.com", { kind: "play", token, clientData });
  assert.deepEqual(first, { ok: true, keyId: null });
  const again = await m.checkLoginAttest("ANDROID", "jane@example.com", { kind: "play", token, clientData });
  assert.equal("code" in again && again.code, "ATTEST_REFUSED");
});

test("Play verdicts are refused for another app, another sign-in, old tokens, sideloaded copies and failing devices", async () => {
  setEnv({ ...PLAY_ENV });
  const { m, play } = await loadPlay((t) => JSON.parse(t));
  const cases: [string, (h: string) => any][] = [
    ["package", (h) => goodVerdict(h, { requestDetails: { requestPackageName: "com.other.app" } })],
    ["hash", () => goodVerdict(play.playRequestHash("something else"))],
    ["stale", (h) => goodVerdict(h, { requestDetails: { timestampMillis: String(Date.now() - 11 * 60_000) } })],
    ["app", (h) => goodVerdict(h, { appIntegrity: { appRecognitionVerdict: "UNRECOGNIZED_VERSION" } })],
    ["device", (h) => goodVerdict(h, { deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY"] } })],
    ["device", (h) => goodVerdict(h, { deviceIntegrity: { deviceRecognitionVerdict: [] } })],
  ];
  for (const [why, make] of cases) {
    const clientData = m.loginClientData(await m.makeAttestChallenge("login"), "a@b.com");
    const v = make(play.playRequestHash(clientData));
    assert.equal(play.playVerdictProblem(v, play.playRequestHash(clientData)), why);
    const r = await m.checkLoginAttest("ANDROID", "a@b.com", { kind: "play", token: JSON.stringify(v), clientData });
    assert.equal("code" in r && r.code, "ATTEST_REFUSED", why);
  }
});

test("Play token for one email can't sign in another; bad or expired challenges and Google outages are refused", async () => {
  setEnv({ ...PLAY_ENV });
  const { m, play } = await loadPlay((t) => (t === "google-down-token-xxxxxxxx" ? new Error("503") : JSON.parse(t)));
  const clientData = m.loginClientData(await m.makeAttestChallenge("login"), "a@b.com");
  const token = JSON.stringify(goodVerdict(play.playRequestHash(clientData)));
  const other = await m.checkLoginAttest("ANDROID", "someone@else.com", { kind: "play", token, clientData });
  assert.equal("code" in other && other.code, "ATTEST_BAD_REQUEST");
  const regData = m.loginClientData(await m.makeAttestChallenge("register"), "a@b.com");
  const wrongPurpose = await m.checkLoginAttest("ANDROID", "a@b.com", { kind: "play", token: JSON.stringify(goodVerdict(play.playRequestHash(regData))), clientData: regData });
  assert.equal("code" in wrongPurpose && wrongPurpose.code, "ATTEST_CHALLENGE");
  const down = await m.checkLoginAttest("ANDROID", "a@b.com", { kind: "play", token: "google-down-token-xxxxxxxx", clientData });
  assert.equal("code" in down && down.code, "ATTEST_UNAVAILABLE");
  const noKind = await m.checkLoginAttest("ANDROID", "a@b.com", { token, clientData });
  assert.equal("code" in noKind && noKind.code, "ATTEST_BAD_REQUEST");
});

test("the Play signing certificate can be pinned", async () => {
  setEnv({ ...PLAY_ENV });
  const play = await import("../lib/playIntegrity");
  const certHex = "ab".repeat(32);
  const v = goodVerdict("h", { appIntegrity: { certificateSha256Digest: [Buffer.from(certHex, "hex").toString("base64url")] } });
  process.env.PLAY_CERT_SHA256 = certHex.match(/../g)!.join(":").toUpperCase();
  assert.equal(play.playVerdictProblem(v, "h"), null);
  process.env.PLAY_CERT_SHA256 = "cd".repeat(32);
  assert.equal(play.playVerdictProblem(v, "h"), "certificate");
  delete process.env.PLAY_CERT_SHA256;
});
