// Rules for calls included in a package. Pure functions, safe to import
// from both server and client code.
//
// Several numbers here are still open questions (see the open-questions
// doc). They're constants so each one is a one-line change.

export const JOIN_OPENS_MINUTES_BEFORE = 10; // Join button appears 10 min before start
export const JOIN_CLOSES_MINUTES_AFTER = 30; // ...and stays until 30 min after the scheduled end
export const CANCEL_CUTOFF_HOURS = 24; // on-site cancel/reschedule closes 24h before the call
export const CALL_HOLD_HOURS = 48; // after the due date, the student has 48h to book or waive
export const CALL_REMINDER_EVERY_DAYS = 3; // "book your call" nudges while a call is unbooked

type DateLike = string | Date;

export type BookingLike = {
  id: string;
  startTime: DateLike;
  endTime: DateLike;
  status: string; // BOOKED | CANCELLED | COMPLETED
  source?: string | null;
};

export type OrderCallLike = {
  status: string;
  callWaivedAt?: DateLike | null;
  callForfeitedAt?: DateLike | null;
  callHoldAt?: DateLike | null;
  gig: { callsIncluded: number; callLength?: number | null };
  callBookings?: BookingLike[];
};

export function callSummary(order: OrderCallLike, now: Date = new Date()) {
  const included = order.gig?.callsIncluded ?? 0;
  const live = (order.callBookings || []).filter((b) => b.status !== "CANCELLED");
  const held = live.filter((b) => b.status === "COMPLETED" || new Date(b.endTime) <= now).length;
  const upcoming = live
    .filter((b) => b.status === "BOOKED" && new Date(b.endTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const waived = !!order.callWaivedAt;
  const forfeited = !!order.callForfeitedAt;
  const toBook = Math.max(0, included - live.length);
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

// Shown when booking, on the order page, on the pre-join screen, and in
// the Terms and Privacy pages. "May be" because recording only runs when
// it's switched on (DAILY_RECORDING_ENABLED).
export const RECORDING_RETENTION_DAYS = 60;
export const RECORDING_NOTICE = `Calls may be recorded for safety and quality. Only the MentorsMD team can watch a recording, and only if there's a problem with an order. Recordings are deleted ${RECORDING_RETENTION_DAYS} days after the order is closed.`;

export function fmtDateTime(d: DateLike) {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
