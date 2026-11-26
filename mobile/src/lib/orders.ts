// Packages (hours orders), calls and money as the website works them out
// (lib/hours.ts, lib/finishing.ts, lib/calls.ts, lib/pricing.ts on the
// website). Pure functions over the JSON the website's routes send, so the
// app shows the same hours left, the same status and the same Join window.
// The one copy for both the student and the mentor screens; status wording
// is in lib/statusLabels.ts, the fee in lib/fee.ts, dates in lib/format.ts.
import { minutesBetween } from "./format";

type DateLike = string | Date | null | undefined;
const ms = (d: DateLike) => (d ? new Date(d).getTime() : NaN);

export type HourEntry = { id: string; type: string; minutes: number; voidedAt?: string | null; callBookingId?: string | null; workDate: string; note?: string | null; fileName?: string | null; loggedBy?: { name: string } | null; createdAt?: string };
export type CallRow = { id: string; startTime: string; endTime: string; status: string; outcome?: string | null; kind?: string | null };
export type Person = { id: string; name: string; photoUrl?: string | null; credential?: string | null };
export type TopUp = { id: string; minutes: number; amountCents?: number; creditAppliedCents?: number; paidAt?: string | null };

// What /api/packages and /api/orders/[id] send for one package (only the
// parts the app uses).
export type Pkg = {
  id: string;
  status: string;
  kind: string | null;
  title?: string;
  packageTitle?: string | null;
  packageDescription?: string | null;
  gig?: { title: string } | null;
  amount: number;
  rateCents: number | null;
  creditAppliedCents: number;
  minutesPurchased: number;
  disputed: boolean;
  disputeResolvedAt?: string | null;
  disputeReason?: string | null;
  markedCompleteAt?: string | null;
  responseDeadline?: string | null;
  lastCallUsedAt?: string | null;
  lastRevisionUsedAt?: string | null;
  lastRequestNote?: string | null;
  approvedAt?: string | null;
  autoApproved?: boolean;
  requestedCallStart?: string | null;
  createdAt: string;
  paidAt?: string | null;
  buyerId: string;
  sellerId: string;
  conversationId: string | null;
  seller: Person;
  buyer?: Person;
  hourEntries?: HourEntry[];
  callBookings?: CallRow[];
  topUps?: TopUp[];
  review?: { id: string; rating: number } | null;
  newMessages?: number;
  refundedCreditCents?: number;
  files?: { id: string; attachmentName: string | null; createdAt: string; senderId: string }[];
};

export const pkgTitle = (o: { title?: string; packageTitle?: string | null; gig?: { title: string } | null }) => o.title || o.packageTitle || o.gig?.title || "Package";

// ---------- hours ----------
// Calls that a no-show by the mentor (or an admin) freed: they use no hours.
const FREES_THE_CALL = ["MENTOR_NO_SHOW", "FREE_REBOOK"];
export const callMinutes = (b: { startTime: DateLike; endTime: DateLike }) => minutesBetween(b.startTime, b.endTime);

type Entry = { type: string; minutes: number; voidedAt?: string | null; callBookingId?: string | null };
type Call = { id: string; startTime: string; endTime: string; status: string; outcome?: string | null; kind?: string | null };
export type HoursLike = { minutesPurchased: number; hourEntries?: Entry[]; callBookings?: Call[] };

// Hours used, held for booked calls, and left; plus the calls still to come.
export function hoursSummary(o: HoursLike, now: Date = new Date()) {
  const entries = (o.hourEntries || []).filter((e) => !e.voidedAt);
  const usedCalls = entries.filter((e) => e.type === "CALL").reduce((s, e) => s + e.minutes, 0);
  const usedWritten = entries.filter((e) => e.type === "WRITTEN").reduce((s, e) => s + e.minutes, 0);
  const used = usedCalls + usedWritten;
  const logged = new Set(entries.map((e) => e.callBookingId).filter(Boolean));
  const reserved = (o.callBookings || [])
    .filter((b) => b.status === "BOOKED" && (b.kind ?? "ORDER") === "ORDER" && !logged.has(b.id) && !FREES_THE_CALL.includes(b.outcome || ""))
    .reduce((s, b) => s + callMinutes(b), 0);
  const purchased = Math.max(0, o.minutesPurchased || 0);
  const upcoming = (o.callBookings || []).filter((b) => b.status === "BOOKED" && ms(b.endTime) > now.getTime()).sort((a, b) => ms(a.startTime) - ms(b.startTime));
  return { purchased, used, usedCalls, usedWritten, reserved, left: Math.max(0, purchased - used - reserved), callsHeld: entries.filter((e) => e.type === "CALL").length, upcoming };
}

// "3 h", "30 min", "1.5 h"
export function shortHours(minutes: number) {
  if (minutes > 0 && minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
// "1 hour", "2.5 hours", "30 minutes"
export function hoursLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}
export const priceFor = (minutes: number, rateCents: number) => Math.round((minutes * rateCents) / 60);
export const TOP_UP_HOURS = [1, 2, 3, 5];
export const LOW_HOURS_MINUTES = 60;

// Credit first; at least 50 cents goes on the card when credit doesn't cover it all.
export function splitCredit(totalCents: number, balanceCents: number) {
  const balance = Math.max(0, Math.floor(balanceCents));
  if (balance >= totalCents) return { creditCents: totalCents, chargeCents: 0 };
  const creditCents = Math.max(0, Math.min(balance, totalCents - 50));
  return { creditCents, chargeCents: totalCents - creditCents };
}

// ---------- finishing ----------
export type FinishLike = { status: string; disputed?: boolean; markedCompleteAt?: DateLike; responseDeadline?: DateLike; lastCallUsedAt?: DateLike; lastRevisionUsedAt?: DateLike; approvedAt?: DateLike };
export type Phase = "PAYING" | "WORKING" | "AWAITING_STUDENT" | "APPROVED" | "DISPUTED" | "CLOSED";
export function finishPhase(o: FinishLike): Phase {
  if (o.status === "PENDING_PAYMENT") return "PAYING";
  if (o.approvedAt || o.status === "COMPLETED" || o.status === "RELEASED") return "APPROVED";
  if (o.status !== "IN_ESCROW") return "CLOSED";
  if (o.disputed) return "DISPUTED";
  if (o.markedCompleteAt && o.responseDeadline) return "AWAITING_STUDENT";
  return "WORKING";
}
export const lastRequestAvailable = (o: FinishLike) => !o.lastCallUsedAt && !o.lastRevisionUsedAt;
// Whole hours left for the student to respond (rounded up), or null.
export function hoursToRespond(o: FinishLike, now: Date = new Date()) {
  if (finishPhase(o) !== "AWAITING_STUDENT" || !o.responseDeadline) return null;
  return Math.max(0, Math.ceil((ms(o.responseDeadline) - now.getTime()) / 3600_000));
}
export const isActive = (o: FinishLike) => ["WORKING", "AWAITING_STUDENT", "DISPUTED", "PAYING"].includes(finishPhase(o));
// Running low: 1 hour or less left on an active package that started with more.
export const isLowOnHours = (o: HoursLike & FinishLike) => finishPhase(o) === "WORKING" && (o.minutesPurchased || 0) > LOW_HOURS_MINUTES && hoursSummary(o).left <= LOW_HOURS_MINUTES;

// Why the mentor can't mark the package complete yet (null = they can).
export function markCompleteBlocker(o: FinishLike & { upcomingCalls?: number }) {
  const phase = finishPhase(o);
  if (phase === "AWAITING_STUDENT") return "You've already marked this complete. The student is reviewing it.";
  if (phase === "DISPUTED") return "This order has an open dispute. An admin will resolve it.";
  if (phase !== "WORKING") return "This package isn't active.";
  if ((o.upcomingCalls || 0) > 0) return "A call is still booked on this package. Mark it complete after the call (or cancel it).";
  return null;
}

// ---------- calls ----------
export const JOIN_OPENS_MINUTES_BEFORE = 10;
const JOIN_CLOSES_MINUTES_AFTER = 30;
export function joinState(b: { startTime: DateLike; endTime: DateLike }, now = Date.now()): "early" | "open" | "ended" {
  if (now < ms(b.startTime) - JOIN_OPENS_MINUTES_BEFORE * 60_000) return "early";
  if (now > ms(b.endTime) + JOIN_CLOSES_MINUTES_AFTER * 60_000) return "ended";
  return "open";
}
// More than 24 hours away: can be moved or cancelled in the app without a reason.
export const CANCEL_CUTOFF_HOURS = 24;
export const canChangeOnline = (b: { startTime: DateLike }, now = Date.now()) => ms(b.startTime) - now > CANCEL_CUTOFF_HOURS * 3600_000;
// Inside the cutoff but not started: moving needs a reason (sent as a message).
export const isLateChange = (b: { startTime: DateLike }, now = Date.now()) => !canChangeOnline(b, now) && ms(b.startTime) > now;
export const LATE_REASON_MIN = 20;
export const RECORDING_NOTICE = "Calls may be recorded for safety and quality. Only the mentor on the call and the MentorsMD team can watch a recording; the team only looks if there's a problem with an order.";

// ---------- date boxes ----------
// "MON" and "24" for the little date box on a call card.
export const dow = (d: DateLike) => new Date(d as string).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
export const dayNum = (d: DateLike) => String(new Date(d as string).getDate());
