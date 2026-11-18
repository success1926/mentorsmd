import * as Device from "expo-device";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { attestForLogin, forgetAttestKey } from "./attest";
import { api, ApiError, clearTokens, currentRefreshToken, platform, saveTokens, saveTrustToken, savedUser, setSignedOutHandler, trustToken, type AppUser } from "./api";

// Who is signed in. Restored from the phone's secure storage on launch;
// cleared when the website says the session is over (signed out elsewhere,
// account removed, 30 days unused).
export type Challenge = { challenge: string; method: "TOTP" | "EMAIL"; email: string };
type SignInResult = { status: "signed-in"; user: AppUser } | ({ status: "needs-code" } & Challenge);

type Ctx = {
  user: AppUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  sendCode: (challenge: string) => Promise<void>;
  verify: (challenge: string, method: "TOTP" | "EMAIL", code: string, trust: boolean) => Promise<AppUser>;
  signOut: () => Promise<void>;
  // After deleting the account: forget everything on this phone.
  forget: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

const deviceName = () => [Device.deviceName || Device.modelName || "Phone", "MentorsMD app"].join(" · ").slice(0, 80);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    savedUser().then((u) => {
      setUser(u);
      setReady(true);
    });
    return () => setSignedOutHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const send = async () =>
      api("/api/app/auth/login", { auth: false, body: { email: email.trim(), password, platform, deviceName: deviceName(), trustToken: (await trustToken()) || undefined, attest: await attestForLogin(email) } });
    let r: any;
    try {
      r = await send();
    } catch (e) {
      // The website doesn't know this phone's key (database reset, or the
      // key was removed): make a new one and try once more.
      if (!(e instanceof ApiError && e.data?.code === "ATTEST_UNKNOWN_KEY")) throw e;
      await forgetAttestKey();
      r = await send();
    }
    if (r.status === "needs-code") return { status: "needs-code", challenge: r.challenge, method: r.method, email: r.email };
    await saveTokens(r);
    setUser(r.user);
    return { status: "signed-in", user: r.user };
  }, []);

  const sendCode = useCallback(async (challenge: string) => {
    await api("/api/app/auth/two-step", { auth: false, body: { challenge, action: "send-code" } });
  }, []);

  const verify = useCallback(async (challenge: string, method: "TOTP" | "EMAIL", code: string, trust: boolean) => {
    const r = await api("/api/app/auth/two-step", { auth: false, body: { challenge, action: "verify", method, code: code.replace(/\s/g, ""), trust } });
    if (r.trustToken) await saveTrustToken(r.trustToken);
    await saveTokens(r);
    setUser(r.user);
    return r.user as AppUser;
  }, []);

  const signOut = useCallback(async () => {
    await api("/api/app/auth/logout", { auth: false, body: { refreshToken: await currentRefreshToken() } }).catch(() => {});
    await clearTokens();
    setUser(null);
  }, []);

  const forget = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, sendCode, verify, signOut, forget }), [user, ready, signIn, sendCode, verify, signOut, forget]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

// The area each account opens: students and parents (BUYER) the student
// area, mentors (SELLER) the mentor area. Admins use the website.
export const areaFor = (role: string) => (role === "SELLER" ? "/mentor" : role === "BUYER" ? "/student" : null);
