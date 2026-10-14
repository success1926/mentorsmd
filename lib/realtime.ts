import crypto from "crypto";
import { ENV_TAG, SUPABASE_URL } from "@/lib/supabase";
import { fetchWithTimeout } from "@/lib/request";

// Live updates (new messages, dispute threads) over Supabase Realtime.
// Replaced Pusher in Oct 2026.
//
// How it works:
//  - Every signed-in person listens on ONE private topic of their own:
//    "live:user:<userId>" (or "preview:user:<userId>" on preview sites).
//  - The browser gets a short-lived pass from /api/realtime/token, signed
//    with SUPABASE_JWT_SECRET, saying who they are. A rule in the Supabase
//    project (prisma/supabase-storage-realtime-2026-10.sql) only lets that
//    pass receive its own topic. Browsers can never send anything.
//  - When something happens, the server sends the event to the topic of
//    every person who should see it (sendLive below), e.g. both people in
//    a conversation, or the student, the mentor and the dispute admins.
//
// If Supabase isn't set up (or is down), nothing breaks: pages still load
// everything when opened, and the unread badge still refreshes every minute.

export const userTopic = (userId: string) => `${ENV_TAG}:user:${userId}`;

export const REALTIME_TOKEN_SECONDS = 60 * 60;

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

// Short-lived pass for the browser (HS256, signed with the project's JWT
// secret). Null when not set up.
export function realtimeToken(userId: string): { token: string; topic: string; expiresAt: number } | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + REALTIME_TOKEN_SECONDS;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", iss: "mentorsmd", iat: now, exp }));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${claims}`).digest("base64url");
  return { token: `${header}.${claims}.${signature}`, topic: userTopic(userId), expiresAt: exp * 1000 };
}

// Sends one event to each person's private topic. Never throws: the
// thing that triggered it (e.g. a saved message) has already happened, so
// a hiccup here must not fail the request (the browser would retry and
// create a duplicate).
export async function sendLive(userIds: string[], event: string, payload: unknown) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!key || !SUPABASE_URL || !ids.length) return;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
    // Legacy service_role keys are JWTs and go in Authorization too; the
    // newer "sb_secret_..." keys only go in apikey.
    if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
    const res = await fetchWithTimeout(
      `${SUPABASE_URL}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: ids.map((id) => ({ topic: userTopic(id), event, payload, private: true })) }),
      },
      5000
    );
    if (!res.ok) console.error("Live update failed:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("Live update failed:", err);
  }
}
