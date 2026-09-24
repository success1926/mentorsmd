// Small shared input checks. Every API route receives raw JSON from the
// browser, which anyone can edit - so types, lengths, and formats are
// verified here on the server, never assumed.

export const LIMITS = {
  messageBody: 5000, // also keeps Pusher events under their 10KB size cap
  gigTitle: 120,
  gigDescription: 5000,
  gigDuration: 60,
  name: 100,
  bio: 3000,
  credential: 200,
  reviewComment: 2000,
};

export const GIG_CATEGORIES = ["ESSAY_REVIEW", "MOCK_INTERVIEW", "APPLICATION_STRATEGY", "TUTORING", "OTHER"] as const;

// Prices are entered in dollars. $5 min keeps Stripe fees from eating the
// whole order; $10,000 max catches typos like an extra zero or two.
export function parsePriceToCents(dollars: unknown): number | null {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n < 5 || n > 10_000) return null;
  return Math.round(n * 100);
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

export function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

// Returns a valid Date, or null for garbage input / dates outside the
// allowed window (default: from now to 1 year out).
export function parseDate(value: unknown, opts: { allowPast?: boolean; maxDaysAhead?: number } = {}): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  // Allow up to a day in the past so "today" in any timezone still works.
  if (!opts.allowPast && d.getTime() < now - 24 * 60 * 60 * 1000) return null;
  if (d.getTime() > now + (opts.maxDaysAhead ?? 365) * 24 * 60 * 60 * 1000) return null;
  return d;
}

// Attachments must be files WE stored via /api/upload (Vercel Blob).
// Without this, someone could post a message whose "attachment" link
// points anywhere - a phishing page, or a javascript: URL.
export function isOurBlobUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 1000) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
