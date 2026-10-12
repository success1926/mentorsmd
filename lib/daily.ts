// Daily.co video: private rooms, per-person meeting tokens, cloud
// recordings and webhook checks. Plain fetch() calls to Daily's REST API
// (https://docs.daily.co/reference/rest-api). Server only.
//
// Env:
//   DAILY_API_KEY            - required for video calls
//   DAILY_RECORDING_ENABLED  - "true" turns on automatic cloud recording
//                              (needs a paid Daily plan)
//   DAILY_WEBHOOK_SECRET     - the webhook's HMAC secret, to check that
//                              attendance/recording events really come from Daily
import crypto from "crypto";
import { JOIN_CLOSES_MINUTES_AFTER, JOIN_OPENS_MINUTES_BEFORE } from "@/lib/calls";

const API = "https://api.daily.co/v1";
const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

export function dailyConfigured() {
  if (!process.env.DAILY_API_KEY) {
    warnOnce("key", "DAILY_API_KEY is not set - video calls are switched off until it is.");
    return false;
  }
  return true;
}

export function recordingEnabled() {
  return process.env.DAILY_RECORDING_ENABLED === "true";
}

function headers() {
  return { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" };
}

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, cache: "no-store" });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

export function roomNameFor(bookingId: string) {
  return `mmd-${bookingId}`.slice(0, 60);
}

function roomExp(end: Date) {
  // Rooms close a little after the Join button does.
  return Math.floor(end.getTime() / 1000) + (JOIN_CLOSES_MINUTES_AFTER + 30) * 60;
}

// Creates the private room for a call, or updates its closing time if it
// already exists (e.g. after a reschedule). Returns null when Daily isn't
// set up or the API call failed (the Join step tries again later).
export async function ensureRoom(booking: { id: string; endTime: Date }): Promise<{ name: string; url: string } | null> {
  if (!dailyConfigured()) return null;
  const name = roomNameFor(booking.id);
  const properties: Record<string, any> = {
    exp: roomExp(booking.endTime),
    enable_chat: true,
    enable_prejoin_ui: true,
    enable_knocking: false,
    max_participants: 4,
    ...(recordingEnabled() ? { enable_recording: "cloud" } : {}),
  };
  const existing = await daily(`/rooms/${name}`);
  if (existing.ok && existing.data?.url) {
    // Also makes sure rooms created before Phase 3 (which were public) are private.
    await daily(`/rooms/${name}`, { method: "POST", body: JSON.stringify({ privacy: "private", properties }) }).catch(() => null);
    return { name, url: existing.data.url };
  }
  const created = await daily("/rooms", { method: "POST", body: JSON.stringify({ name, privacy: "private", properties }) });
  if (!created.ok || !created.data?.url) {
    console.error("Daily room create failed", created.status, created.data);
    return null;
  }
  return { name, url: created.data.url };
}

export async function deleteRoom(name: string | null | undefined) {
  if (!name || !dailyConfigured()) return;
  await daily(`/rooms/${name}`, { method: "DELETE" }).catch(() => null);
}

// A meeting token lets one named person into one private room, only
// around the call's time.
export async function createMeetingToken(opts: {
  roomName: string;
  userId: string;
  userName: string;
  start: Date;
  end: Date;
  isOwner?: boolean;
}): Promise<string | null> {
  if (!dailyConfigured()) return null;
  const properties: Record<string, any> = {
    room_name: opts.roomName,
    user_id: opts.userId.slice(0, 36),
    user_name: opts.userName.slice(0, 60),
    is_owner: !!opts.isOwner,
    nbf: Math.floor(opts.start.getTime() / 1000) - (JOIN_OPENS_MINUTES_BEFORE + 5) * 60,
    exp: Math.floor(opts.end.getTime() / 1000) + JOIN_CLOSES_MINUTES_AFTER * 60,
    eject_at_token_exp: true,
  };
  if (recordingEnabled()) {
    properties.enable_recording = "cloud";
    properties.start_cloud_recording = true;
  }
  const res = await daily("/meeting-tokens", { method: "POST", body: JSON.stringify({ properties }) });
  if (!res.ok || !res.data?.token) {
    console.error("Daily token failed", res.status, res.data);
    return null;
  }
  return res.data.token as string;
}

// A short-lived link to watch/download a recording (admins only).
export async function recordingAccessLink(recordingId: string): Promise<string | null> {
  if (!dailyConfigured()) return null;
  const res = await daily(`/recordings/${encodeURIComponent(recordingId)}/access-link?valid_for_secs=3600`);
  return res.ok ? res.data?.download_link || null : null;
}

export async function deleteRecording(recordingId: string): Promise<boolean> {
  if (!dailyConfigured()) return false;
  const res = await daily(`/recordings/${encodeURIComponent(recordingId)}`, { method: "DELETE" });
  // Already gone counts as deleted.
  return res.ok || res.status === 404;
}

// Sets up the webhook in Daily that sends attendance and recording events
// to this site. Returns Daily's answer (including the secret to save as
// DAILY_WEBHOOK_SECRET).
export async function createWebhook(url: string) {
  if (!dailyConfigured()) return { ok: false, status: 0, data: { error: "DAILY_API_KEY is not set" } };
  return daily("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url,
      eventTypes: ["participant.joined", "participant.left", "recording.started", "recording.ready-to-download", "recording.error"],
    }),
  });
}

// Daily signs each webhook: base64(HMAC-SHA256(base64-decoded secret,
// "<timestamp>.<body>")), sent in X-Webhook-Signature with the timestamp
// in X-Webhook-Timestamp. Without DAILY_WEBHOOK_SECRET set, events are
// accepted unchecked (and a warning is logged once).
export function verifyDailyWebhook(body: string, timestamp: string | null, signature: string | null) {
  const secret = process.env.DAILY_WEBHOOK_SECRET;
  if (!secret) {
    warnOnce("webhook", "DAILY_WEBHOOK_SECRET is not set - Daily webhook events are accepted without a signature check.");
    return true;
  }
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", Buffer.from(secret, "base64")).update(`${timestamp}.${body}`).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
