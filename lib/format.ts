// Shared date, time and name formatting for every page (no server imports).
// Dates show in the viewer's own time zone unless `timeZone` is passed;
// use timeZone "UTC" only for date-only values (birth dates, cycle dates).

export { money } from "./options";

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
/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date */
export function fmtAgo(d: D, now: Date = new Date()) {
  const x = toDate(d);
  if (!ok(x)) return "";
  const s = Math.round((now.getTime() - x.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} day${s < 2 * 86400 ? "" : "s"} ago`;
  return fmtDay(x);
}

/** First word of a name ("" when there is none). */
export const firstName = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "";
/** Up to two capital initials, "?" when there is no name. */
export function initialsOf(name: string | null | undefined) {
  const s = (name || "").trim();
  if (!s) return "?";
  return s.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
