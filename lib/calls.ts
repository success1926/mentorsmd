// Rules for calls included in a package. Pure functions, safe to import
// from both server and client code.
//
// Several numbers here are still open questions (see the open-questions
// doc). They're constants so each one is a one-line change.

export const JOIN_OPENS_MINUTES_BEFORE = 10; // Join button appears 10 min before start
export const JOIN_CLOSES_MINUTES_AFTER = 30; // ...and stays until 30 min after the scheduled end
export const CANCEL_CUTOFF_HOURS = 24; // online cancel/reschedule closes 24h before the call
export const CALL_HOLD_HOURS = 48; // after the due date, the student has 48h to book or waive
export const CALL_REMINDER_EVERY_DAYS = 3; // "book your call" nudges while a call is unbooked

type DateLike = string | Date;

export type BookingLike = {
  id: string;
  startTime: DateLike;
  endTime: DateLike;
  status: string; // BOOKED | CANCELLED | COMPLETED
  source?: string | null;
  calUid?: string | null;
  meetingUrl?: string | null;
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

// Only accept real https Cal.com-style links, so nobody can put a
// javascript: URL or a phishing page behind the "Book a call" button.
export function normalizeCalLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    const allowed = (process.env.NEXT_PUBLIC_CAL_HOSTS || "cal.com,app.cal.com,cal.eu")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) return null;
    if (u.pathname.length < 2) return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

// The link the student opens to book. The order id rides along as Cal.com
// booking metadata, which Cal.com sends back in its webhook - that's how
// a booking gets attached to the right order.
export function calBookingUrl(base: string, opts: { orderId: string; name?: string; email?: string }) {
  const u = new URL(base);
  if (opts.name) u.searchParams.set("name", opts.name);
  if (opts.email) u.searchParams.set("email", opts.email);
  u.searchParams.set("metadata[orderId]", opts.orderId);
  return u.toString();
}

export function calManageUrls(base: string | null | undefined, uid: string | null | undefined) {
  if (!uid) return null;
  let origin = "https://cal.com";
  try {
    if (base) origin = new URL(base).origin;
  } catch {}
  if (origin === "https://app.cal.com") origin = "https://cal.com";
  return {
    reschedule: `${origin}/reschedule/${encodeURIComponent(uid)}`,
    cancel: `${origin}/booking/${encodeURIComponent(uid)}?cancel=true`,
  };
}

export function fmtDateTime(d: DateLike) {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
