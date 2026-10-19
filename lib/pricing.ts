// Hourly pricing (redesign Oct 2026, docs/redesign-2026-10.md section 3).
// Every price is hours x a per-hour rate; nothing is typed in by hand.
// Pure functions, safe to import from both server and client code.
import { RATE_MAX_CENTS, RATE_MIN_CENTS, money } from "@/lib/options";

export type OfferKind = "HOURLY" | "BUNDLE" | "SPECIALIZED";
export const OFFER_KINDS: OfferKind[] = ["HOURLY", "BUNDLE", "SPECIALIZED"];

// Whole dollars, $50 to $2,000 an hour.
export function isValidRate(cents: unknown): cents is number {
  return typeof cents === "number" && Number.isInteger(cents) && cents % 100 === 0 && cents >= RATE_MIN_CENTS && cents <= RATE_MAX_CENTS;
}

// "$75" -> 7500, or null when it isn't a valid rate.
export function parseRateDollars(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(/^\$/, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  const cents = n * 100;
  return isValidRate(cents) ? cents : null;
}

// The per-hour rate an offer uses: its own, or the mentor's hourly rate.
export function offerRate(offer: { rateCents?: number | null }, mentorRateCents: number | null | undefined): number | null {
  return offer.rateCents ?? mentorRateCents ?? null;
}

// Price in cents for some minutes at a per-hour rate.
export function priceFor(minutes: number, rateCents: number) {
  return Math.round((minutes * rateCents) / 60);
}

// The minutes an offer sells (an hourly offer is always 1 hour).
export function offerMinutes(offer: { kind?: string | null; minutes?: number | null }) {
  if (offer.kind === "HOURLY") return 60;
  return offer.minutes ?? 0;
}

// The price of an offer, or null while the mentor has no rate yet.
export function offerPrice(offer: { kind?: string | null; minutes?: number | null; rateCents?: number | null }, mentorRateCents: number | null | undefined) {
  const rate = offerRate(offer, mentorRateCents);
  const minutes = offerMinutes(offer);
  return rate && minutes ? priceFor(minutes, rate) : null;
}

// "3 hours", "1.5 hours", "1 hour", "30 minutes".
export function hoursLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}

// "3 hours × $80/hr = $240"
export function priceMath(minutes: number, rateCents: number) {
  return `${hoursLabel(minutes)} × ${money(rateCents)}/hr = ${money(priceFor(minutes, rateCents))}`;
}
