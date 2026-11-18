// Packages (hours orders), calls and money as the website works them out
// (lib/hours.ts, lib/finishing.ts, lib/calls.ts, lib/pricing.ts on the
// website). Pure functions over the JSON the website's routes send, so the
// app shows the same hours left, the same status and the same Join window.

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
export const first = (n?: string | null) => (n || "").replace(/^Dr\.?\s+/, "").split(" ")[0];
export const initials = (n?: string | null) => (n || "").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";

// ---------- hours ----------
// Calls that a no-show by the mentor (or an admin) freed: they use no hours.
const FREES_THE_CALL = ["MENTOR_NO_SHOW", "FREE_REBOOK"];
export const callMinutes = (b: { startTime: DateLike; endTime: DateLike }) => Math.round((ms(b.endTime) - ms(b.startTime)) / 60_000);

export function hoursSummary(o: Pick<Pkg, "minutesPurchased" | "hourEntries" | "callBookings">) {
  const entries = (o.hourEntries || []).filter((e) => !e.voidedAt);
  const usedCalls = entries.filter((e) => e.type === "CALL").reduce((s, e) => s + e.minutes, 0);
  const usedWritten = entries.filter((e) => e.type === "WRITTEN").reduce((s, e) => s + e.minutes, 0);
  const used = usedCalls + usedWritten;
  const logged = new Set(entries.map((e) => e.callBookingId).filter(Boolean));
  const reserved = (o.callBookings || [])
    .filter((b) => b.status === "BOOKED" && (b.kind ?? "ORDER") === "ORDER" && !logged.has(b.id) && !FREES_THE_CALL.includes(b.outcome || ""))
    .reduce((s, b) => s + callMinutes(b), 0);
  const purchased = Math.max(0, o.minutesPurchased || 0);
  return { purchased, used, usedCalls, usedWritten, reserved, left: Math.max(0, purchased - used - reserved), callsHeld: entries.filter((e) => e.type === "CALL").length };
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
export type Phase = "PAYING" | "WORKING" | "AWAITING_STUDENT" | "APPROVED" | "DISPUTED" | "CLOSED";
export function finishPhase(o: Pick<Pkg, "status" | "disputed" | "markedCompleteAt" | "responseDeadline" | "approvedAt">): Phase {
  if (o.status === "PENDING_PAYMENT") return "PAYING";
  if (o.approvedAt || o.status === "COMPLETED" || o.status === "RELEASED") return "APPROVED";
  if (o.status !== "IN_ESCROW") return "CLOSED";
  if (o.disputed) return "DISPUTED";
  if (o.markedCompleteAt && o.responseDeadline) return "AWAITING_STUDENT";
  return "WORKING";
}
export const lastRequestAvailable = (o: Pick<Pkg, "lastCallUsedAt" | "lastRevisionUsedAt">) => !o.lastCallUsedAt && !o.lastRevisionUsedAt;
export function hoursToRespond(o: Pkg, now = Date.now()) {
  if (finishPhase(o) !== "AWAITING_STUDENT" || !o.responseDeadline) return null;
  return Math.max(0, Math.ceil((ms(o.responseDeadline) - now) / 3600_000));
}

export type Tone = "plain" | "ok" | "warn" | "bad" | "gray";
// The badge on a package, same words as the website.
export function packageStatus(o: Pkg): { label: string; tone: Tone } {
  const phase = finishPhase(o);
  if (phase === "PAYING") return { label: "Awaiting payment", tone: "gray" };
  if (phase === "DISPUTED") return { label: "Disputed", tone: "bad" };
  if (phase === "APPROVED") return { label: "Completed", tone: "ok" };
  if (phase === "CLOSED") return { label: o.status === "REFUNDED" ? "Refunded" : "Cancelled", tone: "gray" };
  if (phase === "AWAITING_STUDENT") return { label: `Respond in ${hoursToRespond(o)} h`, tone: "warn" };
  if (o.lastCallUsedAt || o.lastRevisionUsedAt) return { label: o.lastCallUsedAt ? "Last call requested" : "Last revision requested", tone: "plain" };
  return { label: "Active", tone: "plain" };
}
export const isActive = (o: Pkg) => ["WORKING", "AWAITING_STUDENT", "DISPUTED", "PAYING"].includes(finishPhase(o));

// ---------- calls ----------
export const JOIN_OPENS_MINUTES_BEFORE = 10;
const JOIN_CLOSES_MINUTES_AFTER = 30;
export function joinState(b: { startTime: DateLike; endTime: DateLike }, now = Date.now()): "early" | "open" | "ended" {
  if (now < ms(b.startTime) - JOIN_OPENS_MINUTES_BEFORE * 60_000) return "early";
  if (now > ms(b.endTime) + JOIN_CLOSES_MINUTES_AFTER * 60_000) return "ended";
  return "open";
}
// More than 24 hours away: can be moved or cancelled in the app without a reason.
export const canChangeOnline = (b: { startTime: DateLike }, now = Date.now()) => ms(b.startTime) - now > 24 * 3600_000;
export const RECORDING_NOTICE = "Calls may be recorded for safety and quality. Only the mentor on the call and the MentorsMD team can watch a recording; the team only looks if there's a problem with an order.";

// ---------- dates ----------
export const fmtDay = (d: DateLike) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
export const fmtDayYear = (d: DateLike) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
export const fmtTime = (d: DateLike) => (d ? new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
export const fmtWhen = (d: DateLike) => (d ? `${new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${fmtTime(d)}` : "");
export const dow = (d: DateLike) => new Date(d as string).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
export const dayNum = (d: DateLike) => String(new Date(d as string).getDate());
// "2h", "Yesterday", "Oct 2" for message lists.
export function ago(d: DateLike) {
  const t = ms(d);
  if (isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "Now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 24 * 3600_000) return `${Math.floor(diff / 3600_000)}h`;
  if (diff < 48 * 3600_000) return "Yesterday";
  return fmtDay(d);
}
export function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}
