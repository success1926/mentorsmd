import * as AppIntegrity from "@expo/app-integrity";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, ApiError, platform } from "./api";

// Apple App Attest: proves to mentorsmd.com that a sign-in comes from the
// real MentorsMD app on a real iPhone (lib/appAttest.ts on the website).
//   - Once per install: make a key in the Secure Enclave, have Apple vouch
//     for it, register it with the website (/api/app/attest/register).
//   - Every sign-in: sign {"challenge","email"} with that key.
// Android uses Google Play Integrity instead (lib/playIntegrity.ts on the
// website): every sign-in asks Google Play for a token bound to a hash of
// the same {"challenge","email"} text. The website says when it wants one.
// Simulators can't do either; previews let them sign in without.

const K_KEY = "mmd.attestKey";

export type LoginAttest = { keyId: string; assertion: string; clientData: string } | { kind: "play"; token: string; clientData: string };

export const attestSupported = () => Platform.OS === "ios" && AppIntegrity.isSupported;

type Challenge = { challenge: string; play?: { projectNumber: string } };
const getChallenge = (purpose: "register" | "login") => api<Challenge>("/api/app/attest/challenge", { auth: false, body: { purpose, platform } });
const challenge = async (purpose: "register" | "login") => (await getChallenge(purpose)).challenge;

export const forgetAttestKey = () => SecureStore.deleteItemAsync(K_KEY).catch(() => {});

// The registered key on this phone, making and registering one if needed.
// null when this website doesn't check (a preview without Apple settings).
async function registeredKey(): Promise<string | null> {
  const saved = await SecureStore.getItemAsync(K_KEY).catch(() => null);
  if (saved) return saved;
  const keyId = await AppIntegrity.generateKeyAsync();
  const c = await challenge("register");
  const attestation = await AppIntegrity.attestKeyAsync(keyId, c);
  try {
    await api("/api/app/attest/register", { auth: false, body: { keyId, attestation, challenge: c } });
  } catch (e) {
    if (e instanceof ApiError && e.data?.code === "ATTEST_UNCONFIGURED") return null;
    throw e;
  }
  await SecureStore.setItemAsync(K_KEY, keyId);
  return keyId;
}

// What the app sends with a sign-in, or undefined when it can't attest.
// Must match loginClientData() on the website exactly.
export async function attestForLogin(email: string): Promise<LoginAttest | undefined> {
  if (Platform.OS === "android") return playForLogin(email);
  if (!attestSupported()) return undefined;
  try {
    const keyId = await registeredKey();
    if (!keyId) return undefined;
    const clientData = JSON.stringify({ challenge: await challenge("login"), email: email.trim().toLowerCase() });
    const assertion = await AppIntegrity.generateAssertionAsync(keyId, clientData);
    return { keyId, assertion, clientData };
  } catch (e) {
    // The website's own answers (too many tries, refused...) say what to do.
    if (e instanceof ApiError) throw e;
    // Apple's service didn't answer, or the key is gone (e.g. restored onto
    // a new iPhone): start over with a new key next time.
    await forgetAttestKey();
    throw new Error("Couldn't check this iPhone with Apple. Check your connection and try again.");
  }
}

// ---- Android: Google Play Integrity ----

let preparedFor: string | null = null;

async function playForLogin(email: string): Promise<LoginAttest | undefined> {
  const c = await getChallenge("login");
  // No project number = this website doesn't ask Android for a token.
  if (!c.play?.projectNumber) return undefined;
  const clientData = JSON.stringify({ challenge: c.challenge, email: email.trim().toLowerCase() });
  try {
    if (preparedFor !== c.play.projectNumber) {
      await AppIntegrity.prepareIntegrityTokenProviderAsync(c.play.projectNumber);
      preparedFor = c.play.projectNumber;
    }
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, clientData, { encoding: Crypto.CryptoEncoding.HEX });
    const token = await AppIntegrity.requestIntegrityCheckAsync(hash);
    return { kind: "play", token, clientData };
  } catch {
    // Google Play services missing or not answering: prepare again next time.
    preparedFor = null;
    throw new Error("Couldn't check this phone with Google Play. Make sure Google Play is up to date, check your connection, and try again.");
  }
}
