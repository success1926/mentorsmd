// Shared date, time, money and name formatting for every screen, matching
// the website's lib/format.ts: en-US wording ("Nov 24, 2026", "Mon, Nov 24",
// "3:30 PM") in the phone's own time zone. Pass timeZone "UTC" only for
// date-only values.

type D = string | number | Date | null | undefined;
type Opts = { timeZone?: string };
const toDate = (d: D) => (d === null || d === undefined || d === "" ? null : d instanceof Date ? d : new Date(d));
const ok = (d: Date | null): d is Date => !!d && !isNaN(d.getTime());

/** "Nov 24, 2026" */
export function fmtDay(d: D, o: Opts = {}) {
  const x = toDate(d);
  return ok(x) ? x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: o.timeZone }) : "";
}
/** "Mon, Nov 24" (adds the year when it isn't this year) */
export function fmtDayShort(d: D, o: Opts = {}) {
  const x = toDate(d);
  if (!ok(x)) return "";
  const thisYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(thisYear ? {} : { year: "numeric" }), timeZone: o.timeZone });
}
/** "Nov 24": for tight spots (chips, list times, stat boxes). */
export function fmtMonthDay(d: D, o: Opts = {}) {
  const x = toDate(d);
  return ok(x) ? x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: o.timeZone }) : "";
}
/** "3:30 PM" */
export function fmtTime(d: D, o: Opts & { zone?: boolean } = {}) {
  const x = toDate(d);
  return ok(x) ? x.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(o.zone ? { timeZoneName: "short" } : {}), timeZone: o.timeZone }) : "";
}
/** "Mon, Nov 24, 3:30 PM" */
export function fmtDateTime(d: D, o: Opts & { zone?: boolean } = {}) {
  const x = toDate(d);
  return ok(x) ? `${fmtDayShort(x, o)}, ${fmtTime(x, o)}` : "";
}
/** "November 2026" */
export function fmtMonth(d: D, o: Opts = {}) {
  const x = toDate(d);
  return ok(x) ? x.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: o.timeZone }) : "";
}
/** "Today", "Tomorrow", "Yesterday" or "Sat, Nov 21". */
export function dayWord(d: D) {
  const x = toDate(d);
  if (!ok(x)) return "";
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const x0 = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((x0 - t0) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDayShort(x);
}
/** "Now", "5m", "3h", "Yesterday", "Mon", then "Nov 2": times in message lists. */
export function ago(d: D) {
  const x = toDate(d);
  if (!ok(x)) return "";
  const mins = Math.max(0, Math.round((Date.now() - x.getTime()) / 60000));
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h`;
  if (mins < 48 * 60) return "Yesterday";
  if (mins < 7 * 24 * 60) return x.toLocaleDateString("en-US", { weekday: "short" });
  return fmtMonthDay(x);
}

// "YYYY-MM-DD" for a local calendar day, and back.
export const dayString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromDayString = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m || 1) - 1, d || 1);
};
/** A "YYYY-MM-DD" day as "Nov 24, 2026". */
export const fmtDayString = (s: string) => fmtDay(fromDayString(s));

/** Whole minutes between two times. */
export const minutesBetween = (a: D, b: D) => {
  const x = toDate(a);
  const y = toDate(b);
  return ok(x) && ok(y) ? Math.round((y.getTime() - x.getTime()) / 60000) : 0;
};

/** The phone's time zone name, e.g. "America/New_York". */
export function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

/** Dollars (not cents) as "$1,250" or "$12.50". For cents use dollars() in lib/api.ts. */
export const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** First word of a name ("" when there is none); a leading "Dr." is skipped. */
export const firstName = (name: string | null | undefined) => (name || "").trim().replace(/^Dr\.?\s+/i, "").split(/\s+/)[0] || "";
/** Up to two capital initials, "?" when there is no name. */
export function initialsOf(name: string | null | undefined) {
  const s = (name || "").trim();
  if (!s) return "?";
  return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
