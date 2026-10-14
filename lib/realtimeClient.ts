"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Browser side of live updates (lib/realtime.ts explains the setup).
// One connection per browser tab, shared by everything on the page:
//
//   useEffect(() => onLive((event, payload) => { ... }), []);
//
// Events: "message" { conversationId, message } and
//         "dispute-message" { orderId, message }.
//
// If the keys aren't set or the connection fails, onLive simply never
// calls back; pages still load their data when opened.

type Handler = (event: string, payload: any) => void;

const handlers = new Set<Handler>();
let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;
let pass: { token: string; topic: string; expiresAt: number } | null = null;
let starting: Promise<void> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
let connected = false;

// True while live updates are actually arriving. Pages poll as a fallback
// when this is false.
export const isLive = () => connected;

async function fetchPass() {
  const res = await fetch("/api/realtime/token", { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.enabled ? (data as { token: string; topic: string; expiresAt: number }) : null;
}

// Supabase asks for the pass on connect and with every heartbeat (about
// every 25 seconds); a new one is fetched 5 minutes before it expires.
async function currentToken(): Promise<string | null> {
  if (pass && pass.expiresAt - Date.now() < 5 * 60 * 1000) {
    const fresh = await fetchPass().catch(() => null);
    if (fresh) pass = fresh;
  }
  return pass?.token ?? null;
}

async function start() {
  let url = "";
  try {
    url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
  } catch {}
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  pass = await fetchPass().catch(() => null);
  if (!pass || !handlers.size) return;
  // Loaded only once someone signed in actually needs it, to keep pages light.
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url, key, { accessToken: currentToken });
  }
  if (!handlers.size) return;
  channel = client
    .channel(pass.topic, { config: { private: true } })
    .on("broadcast", { event: "*" }, (msg: any) => {
      handlers.forEach((h) => {
        try {
          h(msg.event, msg.payload);
        } catch (err) {
          console.error(err);
        }
      });
    })
    .subscribe((status, err) => {
      connected = status === "SUBSCRIBED";
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("Live updates unavailable:", status, err?.message || "");
    });
}

function stop() {
  if (channel && client) client.removeChannel(channel);
  channel = null;
  pass = null;
  connected = false;
}

export function onLive(handler: Handler): () => void {
  handlers.add(handler);
  clearTimeout(stopTimer);
  if (!channel && !starting) starting = start().finally(() => (starting = null));
  return () => {
    handlers.delete(handler);
    // Moving between pages swaps listeners; keep the connection briefly
    // so it isn't torn down and rebuilt each time.
    if (!handlers.size) stopTimer = setTimeout(() => !handlers.size && stop(), 5000);
  };
}
