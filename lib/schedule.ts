// The built-in calendar's rules: mentor availability, busy dates, due
// dates and call slots. Pure functions, safe to import from both server
// and client code. Every number is a one-line constant.
import { addDays, dayInZone, isDayString, isTimeString, weekdayOfDay, zonedToUtc } from "@/lib/tz";

// ---------- Availability ----------

// Weekly hours keyed by weekday ("0" = Sunday), in the mentor's time zone.
export type WeeklyHours = Record<string, [string, string][]>;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const BUFFER_OPTIONS = [0, 10, 15, 30, 60]; // minutes kept free around each call
export const NOTICE_OPTIONS = [2, 4, 12, 24, 48, 72]; // hours of notice a student must give
export const SLOT_STEP_MINUTES = 30; // calls can start on the hour or half hour
export const BOOKING_HORIZON_DAYS = 60; // how far ahead students can book
export const MAX_WINDOWS_PER_DAY = 4;

// Validates weekly hours from the browser. Returns null when invalid.
export function parseWeeklyHours(value: unknown): WeeklyHours | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: WeeklyHours = {};
  for (let d = 0; d < 7; d++) {
    const raw = (value as any)[String(d)];
    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw) || raw.length > MAX_WINDOWS_PER_DAY) return null;
    const windows: [string, string][] = [];
    for (const w of raw) {
      if (!Array.isArray(w) || w.length !== 2 || !isTimeString(w[0]) || !isTimeString(w[1])) return null;
      if (w[0] >= w[1]) return null; // must end after it starts (same day)
      windows.push([w[0], w[1]]);
    }
    windows.sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 1; i < windows.length; i++) if (windows[i][0] < windows[i - 1][1]) return null; // overlap
    if (windows.length) out[String(d)] = windows;
  }
  return out;
}

export function hasAvailability(weeklyHours: unknown) {
  const wh = parseWeeklyHours(weeklyHours);
  return !!wh && Object.values(wh).some((w) => w.length > 0);
}

// ---------- Busy dates ----------

export const BUSY_KINDS = [
  { value: "NO_DEADLINES", label: "No deadlines" },
  { value: "NO_DEADLINES_NO_CALLS", label: "No deadlines and no calls" },
];

export type BusyRange = { startDay: string; endDay: string; kind: string };

// forCalls = true: only ranges that also block calls count.
export function isBusyDay(day: string, ranges: BusyRange[], forCalls = false) {
  return ranges.some((r) => day >= r.startDay && day <= r.endDay && (!forCalls || r.kind === "NO_DEADLINES_NO_CALLS"));
}

// The first day on/after `day` that isn't a busy (no-deadline) day.
export function nextFreeDay(day: string, ranges: BusyRange[]) {
  let d = day;
  for (let i = 0; i < 400 && isBusyDay(d, ranges); i++) d = addDays(d, 1);
  return d;
}

export function isValidBusyRange(startDay: unknown, endDay: unknown) {
  return isDayString(startDay) && isDayString(endDay) && startDay <= endDay;
}

// ---------- Due dates ----------

// Minimum time between ordering and the due date, by package turnaround.
export const TURNAROUND_MIN_DAYS: Record<string, number> = { H48: 2, D3_5: 5, W1_2: 14, SCHEDULED: 2 };
export const DEFAULT_MIN_DUE_DAYS = 2;

export function minDueDays(turnaround: string | null | undefined) {
  return (turnaround && TURNAROUND_MIN_DAYS[turnaround]) || DEFAULT_MIN_DUE_DAYS;
}

// Earliest due date for a new order: today + the turnaround, moved past
// any of the mentor's busy dates. `today` is a "YYYY-MM-DD" string.
export function earliestDueDay(today: string, turnaround: string | null | undefined, ranges: BusyRange[]) {
  return nextFreeDay(addDays(today, minDueDays(turnaround)), ranges);
}

export function dueDateExplanation(turnaround: string | null | undefined, earliest: string, ranges: BusyRange[], today: string) {
  const days = minDueDays(turnaround);
  const label =
    turnaround === "H48" ? "a 48-hour turnaround" :
    turnaround === "D3_5" ? "a 3 to 5 day turnaround" :
    turnaround === "W1_2" ? "a 1 to 2 week turnaround" :
    turnaround === "SCHEDULED" ? "a scheduled call" : "this turnaround";
  const skipped = earliest !== addDays(today, days);
  return `This package has ${label}, so the earliest due date is ${days} days from today${skipped ? ", moved past days your mentor is busy" : ""}. Greyed-out dates aren't available.`;
}

// Is `day` allowed as a due date for a new order?
export function dueDayProblem(day: string, today: string, turnaround: string | null | undefined, ranges: BusyRange[]) {
  if (!isDayString(day)) return "Pick a valid due date";
  if (day < addDays(today, minDueDays(turnaround))) return "That's sooner than this package's turnaround allows. Pick a later due date.";
  if (isBusyDay(day, ranges)) return "Your mentor is busy on that date. Pick another due date.";
  if (day > addDays(today, 365)) return "Pick a due date within the next year";
  return null;
}

// The calendar day of a stored due date (due dates are saved as midnight UTC).
export function dueDayOf(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function dayToDueDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

// ---------- Slots ----------

export type Interval = { s: number; e: number }; // milliseconds

export type SlotInput = {
  weeklyHours: unknown;
  timeZone: string;
  bufferMinutes: number;
  minNoticeHours: number;
  daysOff: string[];
  busyRanges: BusyRange[];
  busy: Interval[]; // existing calls + external calendar busy times
  lengthMinutes: number;
  now?: Date;
  horizonDays?: number;
  onlyDay?: string; // limit to one day (mentor's calendar day)
};

// Open start times, as Date objects, sorted.
export function generateSlots(input: SlotInput): Date[] {
  const wh = parseWeeklyHours(input.weeklyHours);
  if (!wh) return [];
  const now = input.now || new Date();
  const tz = input.timeZone;
  const len = input.lengthMinutes * 60_000;
  const buffer = Math.max(0, input.bufferMinutes) * 60_000;
  const earliest = now.getTime() + Math.max(0, input.minNoticeHours) * 3600_000;
  const horizon = input.horizonDays ?? BOOKING_HORIZON_DAYS;
  const today = dayInZone(now, tz);
  const out: Date[] = [];

  for (let i = 0; i <= horizon; i++) {
    const day = addDays(today, i);
    if (input.onlyDay && day !== input.onlyDay) continue;
    if (input.daysOff.includes(day) || isBusyDay(day, input.busyRanges, true)) continue;
    for (const [from, to] of wh[String(weekdayOfDay(day))] || []) {
      const winStart = zonedToUtc(day, from, tz).getTime();
      const winEnd = zonedToUtc(day, to, tz).getTime();
      for (let s = winStart; s + len <= winEnd; s += SLOT_STEP_MINUTES * 60_000) {
        if (s < earliest) continue;
        const e = s + len;
        const clash = input.busy.some((b) => s < b.e + buffer && e > b.s - buffer);
        if (!clash) out.push(new Date(s));
      }
    }
  }
  return out;
}
