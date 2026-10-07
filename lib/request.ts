import crypto from "crypto";

type HeaderSource = Request | { headers?: Record<string, any> | Headers } | null | undefined;

function header(src: HeaderSource, name: string): string {
  const h: any = src && (src as any).headers;
  if (!h) return "";
  if (typeof h.get === "function") return h.get(name) || "";
  const v = h[name] ?? h[name.toLowerCase()];
  return Array.isArray(v) ? v[0] || "" : typeof v === "string" ? v : "";
}

// The visitor's IP address as Vercel reports it ("" when unknown, e.g.
// local development). Never stored as-is: use ipKey() for limits.
export function clientIp(src: HeaderSource): string {
  const fwd = header(src, "x-forwarded-for") || header(src, "x-real-ip");
  return fwd.split(",")[0].trim();
}

// A salted hash of the IP, safe to use as a rate-limit key or to store.
export function ipKey(src: HeaderSource): string {
  const ip = clientIp(src) || "unknown";
  return crypto.createHash("sha256").update(`${process.env.NEXTAUTH_SECRET || "mentorsmd"}:${ip}`).digest("hex").slice(0, 32);
}

// Runs slow, non-essential work (the AI check, Sentry reports) after the
// response has been sent. On Vercel this uses the platform's waitUntil so
// the work isn't cut off when the response finishes; elsewhere (next
// start, local dev) the promise simply keeps running in the background.
export function runAfterResponse(task: () => Promise<unknown>) {
  const promise = Promise.resolve()
    .then(task)
    .catch((err) => console.error("Background task failed:", err));
  try {
    const ctx = (globalThis as any)[Symbol.for("@vercel/request-context")]?.get?.();
    if (ctx?.waitUntil) ctx.waitUntil(promise);
  } catch {
    // not on Vercel - nothing else to do
  }
  return promise;
}

// fetch() with a time limit, so a slow outside service can't hold up a request.
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
