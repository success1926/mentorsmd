// Monthly payouts to mentors (redesign Oct 2026, docs/redesign-2026-10.md
// section 7): the pure rules. No database code, so they can be checked on
// their own and used by client pages. lib/payouts.ts does the work.
//
// On the 24th of each month (America/New_York) every mentor with connected
// Stripe payouts gets ONE transfer for everything not yet paid:
//   1. Hours-log entries (calls held, written work) that aren't voided and
//      aren't in a payout yet, on packages that are active or approved.
//   2. For packages approved by then (COMPLETED) whose unused hours haven't
//      been paid: the unused minutes (hours bought, including paid
//      top-ups, minus hours used). Unused hours aren't refunded; the mentor
//      is paid for them.
//   Hours on a package with an open dispute are held back until an admin
//   decides. Refunded and cancelled packages are never paid.
//   Gross = minutes x the package's own per-hour rate (top-ups are bought
//   at that same rate). The mentor gets gross - 30% (lib/fee.ts).
//
// Refund as credit (section 6, the rule used when an admin settles a
// dispute): the student gets MentorsMD credit of $X, and the package
// closes. The $X comes out of what the mentor hasn't been paid yet for that
// package: their final payout for it is (unpaid hours + unused hours) x
// rate - $X, never below zero. Hours the mentor was already paid for in
// earlier months aren't taken back; if $X is more than what's still
// unpaid, MentorsMD covers the difference. A refund of everything the
// student paid marks the package Refunded and nothing more is paid on it.
// The hours log itself isn't changed (it stays a true record of the work).
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { priceFor } from "@/lib/pricing";

type DateLike = string | Date;

export const PAYOUT_DAY = 24;
export const PAYOUT_TIME_ZONE = "America/New_York";
// A payout stuck in PROCESSING this long (the server stopped between
// claiming the hours and calling Stripe) can be retried by an admin.
export const STUCK_PROCESSING_MS = 30 * 60_000;

export type PayoutEntryLike = { id: string; minutes: number; voidedAt?: DateLike | null; payoutId?: string | null; createdAt: DateLike };
export type PayoutOrderLike = {
  id: string;
  status: string;
  kind?: string | null;
  rateCents: number | null;
  minutesPurchased: number;
  approvedAt?: DateLike | null;
  disputed?: boolean;
  disputeResolvedAt?: DateLike | null;
  unusedMinutesPaid?: number | null;
  hourEntries: PayoutEntryLike[];
  // MentorsMD credit given to the student for this package to settle a
  // dispute (CreditEntry reason DISPUTE_REFUND), in cents.
  refundedCreditCents?: number;
};

export type PayoutLine = {
  orderId: string;
  entryIds: string[];
  entryMinutes: number;
  // Approved packages: the unused minutes paid now (0 otherwise).
  unusedMinutes: number;
  // true = this payout settles the package (it moves to RELEASED once paid).
  final: boolean;
  // Taken off for a refund given as credit (final lines only).
  deductionCents: number;
  grossCents: number;
};

const ms = (d: DateLike | null | undefined) => (d ? new Date(d).getTime() : null);

export const openDispute = (o: { disputed?: boolean; disputeResolvedAt?: DateLike | null }) => !!o.disputed && !o.disputeResolvedAt;

const PAYABLE_STATUSES = ["IN_ESCROW", "COMPLETED"];

// What this payout would pay on one package, or null when nothing is due
// (or it's held by an open dispute: see heldCents).
export function orderPayoutLine(o: PayoutOrderLike, cutoff: Date): PayoutLine | null {
  if (!o.kind || !PAYABLE_STATUSES.includes(o.status) || openDispute(o)) return null;
  const rate = o.rateCents || 0;
  const live = o.hourEntries.filter((e) => !e.voidedAt);
  const approvedAt = ms(o.approvedAt);
  const final = o.status === "COMPLETED" && approvedAt !== null && approvedAt <= cutoff.getTime() && o.unusedMinutesPaid == null;
  // A package being settled pays every unpaid entry; otherwise only what
  // was logged by the cutoff.
  const entries = live.filter((e) => !e.payoutId && (final || (ms(e.createdAt) ?? 0) <= cutoff.getTime()));
  const entryMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const usedMinutes = live.reduce((s, e) => s + e.minutes, 0);
  const unusedMinutes = final ? Math.max(0, (o.minutesPurchased || 0) - usedMinutes) : 0;
  if (!final && !entries.length) return null;
  const before = priceFor(entryMinutes + unusedMinutes, rate);
  const deductionCents = final ? Math.min(before, Math.max(0, o.refundedCreditCents || 0)) : 0;
  return { orderId: o.id, entryIds: entries.map((e) => e.id), entryMinutes, unusedMinutes, final, deductionCents, grossCents: before - deductionCents };
}

// The value (gross, at the package rate) held back by an open dispute.
export function heldCents(o: PayoutOrderLike) {
  if (!o.kind || !PAYABLE_STATUSES.includes(o.status) || !openDispute(o)) return 0;
  const live = o.hourEntries.filter((e) => !e.voidedAt);
  const unpaid = live.filter((e) => !e.payoutId).reduce((s, e) => s + e.minutes, 0);
  const unused = Math.max(0, (o.minutesPurchased || 0) - live.reduce((s, e) => s + e.minutes, 0));
  return priceFor(unpaid + unused, o.rateCents || 0);
}

// What students paid for hours on a package that haven't been paid to the
// mentor yet (gross, at the package rate), for "Not yet paid out" in Admin.
export function unpaidValueCents(o: {
  kind?: string | null;
  status: string;
  rateCents: number | null;
  minutesPurchased: number;
  unusedMinutesPaid?: number | null;
  hourEntries: { minutes: number; voidedAt?: DateLike | null; payoutId?: string | null }[];
  refundedCreditCents?: number;
}) {
  if (!o.kind || !PAYABLE_STATUSES.includes(o.status)) return 0;
  const paid = o.hourEntries.filter((e) => !e.voidedAt && e.payoutId).reduce((s, e) => s + e.minutes, 0) + (o.unusedMinutesPaid ?? 0);
  return Math.max(0, priceFor(Math.max(0, (o.minutesPurchased || 0) - paid), o.rateCents || 0) - (o.refundedCreditCents || 0));
}

export const feeOf = (grossCents: number) => Math.round((grossCents * PLATFORM_FEE_PERCENT) / 100);
export const mentorShare = (grossCents: number) => grossCents - feeOf(grossCents);

// One mentor's payout from their packages' lines.
export function payoutTotals(lines: PayoutLine[]) {
  const grossCents = lines.reduce((s, l) => s + l.grossCents, 0);
  return {
    grossCents,
    feeCents: feeOf(grossCents),
    amountCents: mentorShare(grossCents),
    minutes: lines.reduce((s, l) => s + l.entryMinutes + l.unusedMinutes, 0),
    entryCount: lines.reduce((s, l) => s + l.entryIds.length, 0),
    deductionCents: lines.reduce((s, l) => s + l.deductionCents, 0),
  };
}

export function mentorPayoutPreview(orders: PayoutOrderLike[], cutoff: Date) {
  const lines = orders.map((o) => orderPayoutLine(o, cutoff)).filter((l): l is PayoutLine => !!l);
  const held = orders.reduce((s, o) => s + heldCents(o), 0);
  return { lines, ...payoutTotals(lines), heldGrossCents: held, heldCents: mentorShare(held) };
}

// ---- Dates ----

function nyParts(now: Date) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: PAYOUT_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}
const periodOf = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

// The payout a run belongs to: the month of the most recent 24th (New
// York time), on or before now. The cron runs on the 24th, so that's the
// current month; "Run payouts now" on another day catches up the latest
// payout (it never pays next month's early). One payout per mentor per
// period.
export function payoutPeriod(now: Date = new Date()) {
  const { y, m, d } = nyParts(now);
  if (d >= PAYOUT_DAY) return periodOf(y, m);
  return m === 1 ? periodOf(y - 1, 12) : periodOf(y, m - 1);
}

// The next payout day ("YYYY-MM-24"): today if it's the 24th, else the next 24th.
export function nextPayoutDay(now: Date = new Date()) {
  const { y, m, d } = nyParts(now);
  if (d <= PAYOUT_DAY) return `${periodOf(y, m)}-${PAYOUT_DAY}`;
  return m === 12 ? `${periodOf(y + 1, 1)}-${PAYOUT_DAY}` : `${periodOf(y, m + 1)}-${PAYOUT_DAY}`;
}

// "October 2026" for "2026-10".
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// "Oct 24" for "2026-10-24".
export function payoutDayLabel(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PROCESSING: "Sending",
  PAID: "Paid",
  FAILED: "Failed",
  PENDING: "Pending",
  SKIPPED: "Skipped",
};
