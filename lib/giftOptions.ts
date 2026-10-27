// Gifts from a parent (lib/gifts.ts): the amounts and limits, shared by
// the /gift form and the server. Pure data, safe to import anywhere.

// MentorsMD credit gifts: whole dollars, $50 to $5,000.
export const GIFT_MIN_CENTS = 5_000;
export const GIFT_MAX_CENTS = 500_000;
export const GIFT_PRESETS_CENTS = [10_000, 25_000, 50_000, 100_000];

// The personal note to the student.
export const GIFT_NOTE_MAX = 500;

// How long the student's "Set up your account" link works. After that,
// Forgot password on the login page does the same job.
export const GIFT_CLAIM_DAYS = 60;

export const GIFT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting for payment",
  PAID: "Paid",
  CANCELLED: "Not paid (checkout closed)",
  NEEDS_REVIEW: "Paid, needs the team",
};

// "$75" or "75" -> 7500, or null when it isn't whole dollars in range.
export function parseGiftDollars(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(/^\$/, "").replace(/,/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  const cents = n * 100;
  return cents >= GIFT_MIN_CENTS && cents <= GIFT_MAX_CENTS ? cents : null;
}
