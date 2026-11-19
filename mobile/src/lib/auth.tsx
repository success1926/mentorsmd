import * as Device from "expo-device";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { attestForLogin, forgetAttestKey } from "./attest";
import { api, ApiError, clearTokens, platform, saveTokens, saveTrustToken, savedUser, setSignedOutHandler, takeRefreshTokenForSignOut, trustToken, type AppUser } from "./api";

// Who is signed in. Restored from the phone's secure storage on launch;
// cleared when the website says the session is over (signed out elsewhere,
// account removed, 30 days unused).
export type Challenge = { challenge: string; method: "TOTP" | "EMAIL"; email: string };
type SignInResult = { status: "signed-in"; user: AppUser } | ({ status: "needs-code" } & Challenge);

type Ctx = {
  user: AppUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  sendCode: (challenge: string, auto?: boolean) => Promise<void>;
  verify: (challenge: string, method: "TOTP" | "EMAIL", code: string, trust: boolean) => Promise<AppUser>;
  signOut: () => Promise<void>;
  // After deleting the account: forget everything on this phone.
  forget: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

const TEAM_ONLY = "Team accounts use the MentorsMD website. Students and mentors can sign in here.";
// The website refuses team (admin) accounts; if one gets through anyway,
// end that session rather than keep it on the phone.
const endUnusedSession = (refreshToken: string) => api("/api/app/auth/logout", { auth: false, body: { refreshToken } }).catch(() => {});

const deviceName = () => [Device.deviceName || Device.modelName || "Phone", "MentorsMD app"].join(" · ").slice(0, 80);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    savedUser().then(async (u) => {
      // Signed in without an area here (a team account): sign out.
      if (u && !areaFor(u.role)) {
        const refreshToken = await takeRefreshTokenForSignOut();
        if (refreshToken) await endUnusedSession(refreshToken);
        u = null;
      }
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
    // No area in the app: don't keep the session (the screen says why).
    if (!areaFor(r.user.role)) {
      await endUnusedSession(r.refreshToken);
      return { status: "signed-in", user: r.user };
    }
    await saveTokens(r);
    setUser(r.user);
    return { status: "signed-in", user: r.user };
  }, []);

  // auto: the first code, sent when the screen opens; the website skips it
  // when an earlier code is still good.
  const sendCode = useCallback(async (challenge: string, auto?: boolean) => {
    await api("/api/app/auth/two-step", { auth: false, body: { challenge, action: "send-code", ...(auto ? { auto: true } : {}) } });
  }, []);

  const verify = useCallback(async (challenge: string, method: "TOTP" | "EMAIL", code: string, trust: boolean) => {
    const r = await api("/api/app/auth/two-step", { auth: false, body: { challenge, action: "verify", method, code: code.replace(/\s/g, ""), trust } });
    if (!areaFor(r.user.role)) {
      await endUnusedSession(r.refreshToken);
      throw new ApiError(TEAM_ONLY, 403);
    }
    if (r.trustToken) await saveTrustToken(r.trustToken);
    await saveTokens(r);
    setUser(r.user);
    return r.user as AppUser;
  }, []);

  const signOut = useCallback(async () => {
    // Waits for any refresh on its way first, so the token ended on the
    // website is the latest one and nothing writes tokens back afterwards.
    const refreshToken = await takeRefreshTokenForSignOut();
    await api("/api/app/auth/logout", { auth: false, body: { refreshToken } }).catch(() => {});
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
