import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";

// Talking to mentorsmd.com as the signed-in person.
//
// Sign-in goes through the website's app routes (app/api/app/auth/*,
// lib/appAuth.ts on the website). They hand back two tokens:
//   - an access token (15 minutes), sent as "Authorization: Bearer" on
//     every call. The website's API routes accept it the same as their
//     login cookie (lib/session.ts on the website).
//   - a refresh token (30 days without use), kept in the phone's secure
//     storage (Keychain on iPhone) and traded for a new pair when the
//     access token runs out. Only one refresh may run at a time, because
//     each refresh replaces the refresh token.
export const SITE = (process.env.EXPO_PUBLIC_SITE_URL || "https://www.mentorsmd.com").replace(/\/$/, "");

export type AppUser = { id: string; name: string; email: string; role: "BUYER" | "SELLER" | "ADMIN" | string };
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number; user: AppUser };

const K_REFRESH = "mmd.refresh";
const K_USER = "mmd.user";
const K_TRUST = "mmd.trust";

let access: { token: string; until: number } | null = null;
let refreshing: Promise<boolean> | null = null;
// Goes up each time the tokens are cleared, so a refresh that was already
// on its way can't write tokens back after signing out.
let generation = 0;
// While signing out, no new refresh starts.
let signingOut = false;
let onSignedOut: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function setSignedOutHandler(fn: (() => void) | null) {
  onSignedOut = fn;
}

export async function savedUser(): Promise<AppUser | null> {
  try {
    const [u, r] = await Promise.all([SecureStore.getItemAsync(K_USER), SecureStore.getItemAsync(K_REFRESH)]);
    return u && r ? (JSON.parse(u) as AppUser) : null;
  } catch {
    return null;
  }
}

export async function saveTokens(t: Tokens) {
  access = { token: t.accessToken, until: Date.now() + (t.expiresIn - 30) * 1000 };
  await SecureStore.setItemAsync(K_REFRESH, t.refreshToken);
  await SecureStore.setItemAsync(K_USER, JSON.stringify(t.user));
}

export async function clearTokens() {
  generation++;
  access = null;
  await SecureStore.deleteItemAsync(K_REFRESH).catch(() => {});
  await SecureStore.deleteItemAsync(K_USER).catch(() => {});
}

export const currentRefreshToken = () => SecureStore.getItemAsync(K_REFRESH).catch(() => null);
export const trustToken =() => SecureStore.getItemAsync(K_TRUST).catch(() => null);
export const saveTrustToken = (t: string) => SecureStore.setItemAsync(K_TRUST, t).catch(() => {});

async function doRefresh(): Promise<boolean> {
  const gen = generation;
  const refreshToken = await SecureStore.getItemAsync(K_REFRESH).catch(() => null);
  if (!refreshToken) return false;
  try {
    const r = await fetch(SITE + "/api/app/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    if (gen !== generation) return false; // signed out (or in again) meanwhile
    if (r.status === 401) {
      await clearTokens();
      onSignedOut?.();
      return false;
    }
    if (!r.ok) return false; // a blip: keep the refresh token and try again later
    const tokens = await r.json();
    if (gen !== generation) return false;
    await saveTokens(tokens);
    return true;
  } catch {
    return false;
  }
}

// One refresh at a time, shared by every call waiting on it.
function refresh() {
  if (signingOut) return Promise.resolve(false);
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

// Signing out: waits for any refresh on its way (it replaces the refresh
// token), clears the tokens on this phone and returns the refresh token to
// end on the website.
export async function takeRefreshTokenForSignOut(): Promise<string | null> {
  signingOut = true;
  try {
    while (refreshing) await refreshing.catch(() => false);
    const t = await currentRefreshToken();
    await clearTokens();
    return t;
  } finally {
    signingOut = false;
  }
}

async function currentToken(): Promise<string | null> {
  if (access && access.until > Date.now()) return access.token;
  return (await refresh()) && access ? access.token : null;
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

// Calls a website API route and returns its JSON. Throws ApiError with the
// website's own message ({ error }) when it says no.
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(SITE + path, { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  };
  let token = opts.auth === false ? null : await currentToken();
  let r: Response;
  try {
    r = await send(token);
  } catch {
    throw new ApiError("Can't reach MentorsMD. Check your connection and try again.", 0);
  }
  // The access token ran out early (or the role changed): refresh once and retry.
  if (r.status === 401 && token && (await refresh()) && access) {
    token = access.token;
    r = await send(token);
  }
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!r.ok) throw new ApiError((data && typeof data.error === "string" && data.error) || `Something went wrong (${r.status}). Please try again.`, r.status, data);
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

export const platform = Platform.OS === "android" ? "ANDROID" : "IOS";

// Reads a route for a screen: { data, error, loading, reload }. Reloads
// when the path changes; `reload()` after anything that changes it.
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(path);
      if (mine === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (mine === seq.current) setError(errorText(e));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

// Money from the website is in cents.
export const dollars = (cents: number | null | undefined) => {
  const c = cents || 0;
  const whole = c % 100 === 0;
  return "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
};
