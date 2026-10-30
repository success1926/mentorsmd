// Rules for calls included in a package. Pure functions, safe to import
// from both server and client code.
//
// The numbers are decided (see the open-questions doc). They're constants
// so each one is a one-line change.
import { COUNTS_AS_HELD, DECIDE_WITHIN_HOURS, FREES_THE_CALL, NEEDS_ADMIN } from "@/lib/callOutcomes";

export const JOIN_OPENS_MINUTES_BEFORE = 10; // Join button appears 10 min before start
export const JOIN_CLOSES_MINUTES_AFTER = 30; // ...and stays until 30 min after the scheduled end
export const CANCEL_CUTOFF_HOURS = 24; // on-site cancel/reschedule closes 24h before the call
// Inside those 24 hours a package call can still be moved, but only with a
// written reason, which is posted to the other person as a message.
export const LATE_REASON_MIN = 20;
export const LATE_REASON_MAX = 600;
export const CALL_HOLD_HOURS = 48; // after the due date, the student has 48h to book or waive
export const CALL_REMINDER_EVERY_DAYS = 3; // "book your call" nudges while a call is unbooked

type DateLike = string | Date;

export type BookingLike = {
  id: string;
  startTime: DateLike;
  endTime: DateLike;
  status: string; // BOOKED | CANCELLED | COMPLETED
  source?: string | null;
  outcome?: string | null; // see lib/callOutcomes.ts
};

export type OrderCallLike = {
  status: string;
  callWaivedAt?: DateLike | null;
  callForfeitedAt?: DateLike | null;
  callHoldAt?: DateLike | null;
  gig: { callsIncluded: number; callLength?: number | null };
  callBookings?: BookingLike[];
};

// Whether a booked call counts as having happened.
//   - an outcome of held or student no-show: yes
//   - a mentor no-show, free rebook, nobody joined or unclear: no
//   - no outcome yet: no while it's being checked (up to 48 hours after
//     the end; the cron normally decides within the hour), then yes,
//     the old "end time passed = held" rule for calls from before
//     outcomes existed.
export function callHeld(b: BookingLike, now: Date = new Date()) {
  if (b.status === "COMPLETED" || COUNTS_AS_HELD.includes(b.outcome || "")) return true;
  if (b.outcome) return false;
  return new Date(b.endTime).getTime() <= now.getTime() - DECIDE_WITHIN_HOURS * 3600_000;
}

export function callSummary(order: OrderCallLike, now: Date = new Date()) {
  const included = order.gig?.callsIncluded ?? 0;
  const live = (order.callBookings || []).filter((b) => b.status !== "CANCELLED");
  // A mentor no-show (or a free rebook from an admin) gives the call back,
  // so it doesn't use up one of the package's calls.
  const counted = live.filter((b) => !FREES_THE_CALL.includes(b.outcome || ""));
  const held = counted.filter((b) => callHeld(b, now)).length;
  const upcoming = live
    .filter((b) => b.status === "BOOKED" && new Date(b.endTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  // Ended, but we're still checking who joined.
  const checking = counted.filter((b) => !b.outcome && b.status === "BOOKED" && new Date(b.endTime) <= now && !callHeld(b, now)).length;
  // Nobody joined (or unclear): waiting for an admin to decide.
  const awaitingAdmin = counted.filter((b) => NEEDS_ADMIN.includes(b.outcome || "")).length;
  const mentorNoShows = live.filter((b) => b.outcome === "MENTOR_NO_SHOW").length;
  const waived = !!order.callWaivedAt;
  const forfeited = !!order.callForfeitedAt;
  const toBook = Math.max(0, included - counted.length);
  // The mentor can only mark the work complete once every included call
  // has happened, or the student waived it, or it was forfeited.
  const satisfied = included === 0 || waived || forfeited || held >= included;
  const active = order.status === "IN_ESCROW";
  return {
    included,
    held,
    upcoming,
    toBook,
    satisfied,
    waived,
    forfeited,
    checking,
    awaitingAdmin,
    mentorNoShows,
    // Two mentor no-shows on one order: the student can open a dispute,
    // with a full refund as the expected outcome.
    refundDisputeOpen: mentorNoShows >= 2,
    canBook: active && included > 0 && !waived && !forfeited && toBook > 0,
    onHold: active && !!order.callHoldAt && !waived && !forfeited && toBook > 0,
  };
}

export function joinState(b: BookingLike, now: Date = new Date()): "early" | "open" | "ended" {
  const start = new Date(b.startTime).getTime();
  const end = new Date(b.endTime).getTime();
  if (now.getTime() < start - JOIN_OPENS_MINUTES_BEFORE * 60_000) return "early";
  if (now.getTime() > end + JOIN_CLOSES_MINUTES_AFTER * 60_000) return "ended";
  return "open";
}

export function canChangeOnline(b: BookingLike, now: Date = new Date()) {
  return new Date(b.startTime).getTime() - now.getTime() > CANCEL_CUTOFF_HOURS * 3600_000;
}

// Less than 24 hours to go but not started yet: moving needs a reason.
export function isLateChange(b: BookingLike, now: Date = new Date()) {
  return !canChangeOnline(b, now) && new Date(b.startTime).getTime() > now.getTime();
}

// Shown when booking, on the order page, on the pre-join screen, and in
// the Terms and Privacy pages. "May be" because recording only runs when
// it's switched on (DAILY_RECORDING_ENABLED).
export const RECORDING_RETENTION_DAYS = 60;
export const RECORDING_NOTICE = `Calls may be recorded for safety and quality. Only the mentor on the call and the MentorsMD team can watch a recording; the team only looks if there's a problem with an order. Recordings are deleted ${RECORDING_RETENTION_DAYS} days after the order is closed.`;

export function fmtDateTime(d: DateLike) {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
