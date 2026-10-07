// Time zone helpers built on the browser/Node Intl API (no extra library).
// Safe to import from both server and client code.
//
// "Day" strings are calendar dates "YYYY-MM-DD"; "time" strings are "HH:MM".

export const DEFAULT_TIME_ZONE = "America/New_York";

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function tzOrDefault(tz: string | null | undefined) {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

// The time zone this browser is set to (client only).
export function browserTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

// A sensible list for the Account picker. Uses the full list where the
// runtime has one; the short list is a fallback.
const COMMON_ZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Puerto_Rico", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "UTC",
];
export function timeZoneList(): string[] {
  try {
    const all = (Intl as any).supportedValuesOf?.("timeZone") as string[] | undefined;
    if (all && all.length) return all.includes("UTC") ? all : [...all, "UTC"];
  } catch {}
  return COMMON_ZONES;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function partsIn(date: Date, tz: string): Parts {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(date)) p[x.type] = x.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  };
}

// Minutes the zone is ahead of UTC at that instant.
function offsetMinutes(date: Date, tz: string) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

// The instant when the clock in `tz` shows `day` at `time`.
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let off = offsetMinutes(new Date(guess), tz);
  let utc = guess - off * 60_000;
  const off2 = offsetMinutes(new Date(utc), tz);
  if (off2 !== off) utc = guess - off2 * 60_000;
  return new Date(utc);
}

export function dayInZone(date: Date, tz: string): string {
  const p = partsIn(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function hourInZone(date: Date, tz: string) {
  return partsIn(date, tz).hour;
}

// 0 = Sunday. Pure calendar maths, so no zone needed.
export function weekdayOfDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function isDayString(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isTimeString(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

// "Tue, Oct 14, 3:00 PM EDT" in a given zone (for emails).
export function fmtInZone(date: Date, tz: string, opts: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...opts,
  });
}

// "Oct 14" style label for a day string (no zone shifting).
export function fmtDayLabel(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}
