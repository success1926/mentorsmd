// Hours on an order (redesign Oct 2026, docs/redesign-2026-10.md section 4).
// Pure functions, safe to import from both server and client code.
//
// The rules:
//   - purchased: Order.minutesPurchased (what was bought, plus paid top-ups).
//   - used: every hours-log entry that isn't voided (CALL entries are added
//     automatically when a call is held or the student didn't show up;
//     WRITTEN entries are logged by the mentor).
//   - reserved: calls booked on the order that don't have a log entry yet
//     (upcoming, or ended and waiting for the outcome or an admin). A call
//     that was cancelled, or that the mentor missed (or an admin gave a
//     free rebook), reserves nothing.
//   - left: purchased - used - reserved, never below 0. A new call or a
//     written entry has to fit in what's left.
import { FREES_THE_CALL } from "@/lib/callOutcomes";

type DateLike = string | Date;

export const BLOCK_MINUTES = [30, 60] as const; // calls and written work are 30 or 60 minutes
export const TOP_UP_HOURS = [1, 2, 3, 5];
export const LOW_HOURS_MINUTES = 60; // "1 hour left" email

export type HourEntryLike = { type: string; minutes: number; voidedAt?: DateLike | null; callBookingId?: string | null };
export type OrderCallLike = { id: string; startTime: DateLike; endTime: DateLike; status: string; outcome?: string | null; kind?: string | null };
export type HoursOrderLike = { minutesPurchased: number; hourEntries?: HourEntryLike[]; callBookings?: OrderCallLike[] };

export const isBlockMinutes = (v: unknown): v is 30 | 60 => v === 30 || v === 60;

// A call's booked length in minutes (30 or 60).
export function callMinutes(b: { startTime: DateLike; endTime: DateLike }) {
  return Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60_000);
}

// Calls that hold minutes until they're logged (or cancelled / freed).
export function reservingCalls(order: HoursOrderLike) {
  const logged = new Set((order.hourEntries || []).map((e) => e.callBookingId).filter(Boolean) as string[]);
  return (order.callBookings || []).filter(
    (b) => b.status === "BOOKED" && (b.kind ?? "ORDER") === "ORDER" && !logged.has(b.id) && !FREES_THE_CALL.includes(b.outcome || "")
  );
}

export function hoursSummary(order: HoursOrderLike, now: Date = new Date()) {
  const entries = (order.hourEntries || []).filter((e) => !e.voidedAt);
  const usedCalls = entries.filter((e) => e.type === "CALL").reduce((s, e) => s + e.minutes, 0);
  const usedWritten = entries.filter((e) => e.type === "WRITTEN").reduce((s, e) => s + e.minutes, 0);
  const used = usedCalls + usedWritten;
  const reserved = reservingCalls(order).reduce((s, b) => s + callMinutes(b), 0);
  const purchased = Math.max(0, order.minutesPurchased || 0);
  const left = Math.max(0, purchased - used - reserved);
  const upcoming = (order.callBookings || [])
    .filter((b) => b.status === "BOOKED" && new Date(b.endTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return {
    purchased,
    used,
    usedCalls,
    usedWritten,
    reserved,
    left,
    callsHeld: entries.filter((e) => e.type === "CALL").length,
    writtenCount: entries.filter((e) => e.type === "WRITTEN").length,
    upcoming,
    // Share of the bar: used / reserved / left.
    pctUsed: purchased ? Math.min(100, Math.round((used / purchased) * 100)) : 0,
    pctReserved: purchased ? Math.min(100, Math.round((reserved / purchased) * 100)) : 0,
  };
}

// Can a new block of `minutes` (a call or written work) fit?
export function fits(order: HoursOrderLike, minutes: number) {
  return hoursSummary(order).left >= minutes;
}

// Running low: 1 hour or less left on an active package that started with
// more than that. Shown on the hours bar for both sides, and the trigger
// for the "1 hour left" emails.
export function isLowOnHours(order: HoursOrderLike & { status?: string | null }) {
  if (order.status && order.status !== "IN_ESCROW") return false;
  if ((order.minutesPurchased || 0) <= LOW_HOURS_MINUTES) return false;
  return hoursSummary(order).left <= LOW_HOURS_MINUTES;
}

// "1 hour left" emails (student and mentor): once per running-low episode
// (a top-up that takes the order back above 1 hour clears lowHoursEmailAt).
// Orders that start at 1 hour or less never get them.
export function shouldSendLowHours(order: HoursOrderLike & { lowHoursEmailAt?: DateLike | null }) {
  if (order.lowHoursEmailAt) return false;
  return isLowOnHours(order);
}

// "3 h", "1.5 h", "30 min", "0 h".
export function shortHours(minutes: number) {
  if (minutes > 0 && minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}

// Splits a price between MentorsMD credit and the card. Stripe can't
// charge less than 50 cents, so when credit doesn't cover everything at
// least 50 cents is left for the card.
export const STRIPE_MIN_CENTS = 50;
export function splitCredit(totalCents: number, balanceCents: number) {
  const balance = Math.max(0, Math.floor(balanceCents));
  if (balance >= totalCents) return { creditCents: totalCents, chargeCents: 0 };
  const creditCents = Math.max(0, Math.min(balance, totalCents - STRIPE_MIN_CENTS));
  return { creditCents, chargeCents: totalCents - creditCents };
}

// What each MentorsMD credit ledger entry is (lib/credit.ts).
export const CREDIT_REASON_LABEL: Record<string, string> = {
  DISPUTE_REFUND: "Refund as credit (dispute)",
  ADMIN_ADJUST: "Adjusted by the MentorsMD team",
  SPENT: "Used at checkout",
  SPENT_REVERSED: "Given back (checkout not completed)",
  GIFT: "Gift",
};
