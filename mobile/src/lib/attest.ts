import * as AppIntegrity from "@expo/app-integrity";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api, ApiError } from "./api";

// Apple App Attest: proves to mentorsmd.com that a sign-in comes from the
// real MentorsMD app on a real iPhone (lib/appAttest.ts on the website).
//   - Once per install: make a key in the Secure Enclave, have Apple vouch
//     for it, register it with the website (/api/app/attest/register).
//   - Every sign-in: sign {"challenge","email"} with that key.
// Simulators and Android can't do this; the website lets previews sign in
// without it, and the live site refuses those sign-ins with a message.

const K_KEY = "mmd.attestKey";

export type LoginAttest = { keyId: string; assertion: string; clientData: string };

export const attestSupported = () => Platform.OS === "ios" && AppIntegrity.isSupported;

const challenge = async (purpose: "register" | "login") => (await api<{ challenge: string }>("/api/app/attest/challenge", { auth: false, body: { purpose } })).challenge;

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
