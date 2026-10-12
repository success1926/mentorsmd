// Reads a mentor's own calendar (the secret iCal address Google Calendar
// and iCloud give out) and turns it into busy time ranges, so those times
// are blocked in the slot picker. Server only.
//
// This is a deliberately small .ics reader: single events, all-day
// events, time zones (TZID) and the common repeat rules (daily, weekly
// with days, monthly, yearly; INTERVAL, COUNT, UNTIL, EXDATE). Events
// marked "free" (TRANSP:TRANSPARENT) or cancelled are ignored.
import { addDays, isValidTimeZone, weekdayOfDay, zonedToUtc } from "@/lib/tz";
import type { Interval } from "@/lib/schedule";

export const EXTERNAL_CAL_CACHE_MINUTES = 15;
const MAX_BYTES = 3_000_000;
const FETCH_TIMEOUT_MS = 6000; // keeps the slot picker inside Vercel's 10s limit
const MAX_OCCURRENCES = 5000;

// Accepts https:// and webcal:// links (webcal is just https for calendars).
export function normalizeIcalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().replace(/^webcals?:\/\//i, "https://");
  if (!v || v.length > 2000) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    // No private / local addresses.
    if (host === "localhost" || /^(\d+\.){3}\d+$/.test(host) || host.endsWith(".local") || host.endsWith(".internal") || host.includes(":")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function fetchIcal(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "text/calendar" }, redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error(`The calendar address answered with an error (${res.status}). Check you copied the secret address.`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error("That calendar is too large to read.");
    if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That address isn't an iCal calendar. Copy the secret address in iCal format.");
    return text;
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("The calendar took too long to answer. Try again in a minute.");
    throw err;
  } finally {
    clearTimeout(t);
  }
}

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rest] = left.split(";");
  const params: Record<string, string> = {};
  for (const r of rest) {
    const eq = r.indexOf("=");
    if (eq > 0) params[r.slice(0, eq).toUpperCase()] = r.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: value.trim() };
}

// Windows time zone names some calendars use, mapped to IANA.
const WINDOWS_ZONES: Record<string, string> = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "India Standard Time": "Asia/Kolkata",
};

type When = { ms: number; allDay: boolean; day: string; time: string; tz: string };

function parseWhen(p: Prop, fallbackTz: string): When | null {
  const v = p.value;
  if (p.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const day = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { ms: zonedToUtc(day, "00:00", fallbackTz).getTime(), allDay: true, day, time: "00:00", tz: fallbackTz };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const time = `${m[4]}:${m[5]}`;
  if (m[7] === "Z") return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]), allDay: false, day, time, tz: "UTC" };
  let tz = p.params.TZID || fallbackTz;
  if (WINDOWS_ZONES[tz]) tz = WINDOWS_ZONES[tz];
  if (!isValidTimeZone(tz)) tz = fallbackTz;
  return { ms: zonedToUtc(day, time, tz).getTime(), allDay: false, day, time, tz };
}

function parseDuration(v: string): number {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * 86400 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000;
  return m[1] === "-" ? -ms : ms;
}

const BYDAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function addMonths(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  if (d > last) return null; // e.g. the 31st in a 30-day month: skipped, like real calendars
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Expands one event into its occurrences that overlap [from, to].
// Repeats are worked out on the event's own calendar days and clock time,
// so daylight-saving changes don't shift them.
function expand(start: When, durMs: number, rrule: string | null, exdates: Set<number>, from: number, to: number): Interval[] {
  const out: Interval[] = [];
  const at = (day: string) => zonedToUtc(day, start.time, start.tz).getTime();
  const push = (s: number) => {
    if (exdates.has(s)) return;
    if (s + durMs > from && s < to) out.push({ s, e: s + durMs });
  };
  if (!rrule) {
    push(start.ms);
    return out;
  }
  const r: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) r[k.toUpperCase()] = v;
  }
  const freq = r.FREQ;
  const interval = Math.max(1, parseInt(r.INTERVAL || "1", 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  let until = Infinity;
  if (r.UNTIL) {
    const u = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
    if (u) until = Date.UTC(+u[1], +u[2] - 1, +u[3], +(u[4] || 23), +(u[5] || 59), +(u[6] || 59));
  }
  let n = 0;
  // Without COUNT, jump close to the window instead of walking from an
  // event's first date years ago.
  const DAY = 86400_000;
  const gapDays = count === Infinity ? Math.max(0, Math.floor((from - start.ms) / DAY) - 7) : 0;
  if (freq === "WEEKLY" && r.BYDAY) {
    const days = r.BYDAY.split(",").map((d) => BYDAY[d.slice(-2)]).filter((d) => d !== undefined).sort();
    const sunday = addDays(start.day, -weekdayOfDay(start.day));
    const firstW = Math.floor(gapDays / 7 / interval) * interval;
    for (let w = firstW; w < firstW + MAX_OCCURRENCES && n < count; w += interval) {
      const weekSunday = addDays(sunday, w * 7);
      if (at(weekSunday) > Math.min(to, until)) break;
      for (const d of days) {
        const s = at(addDays(weekSunday, d));
        if (s < start.ms) continue;
        if (s > until || n >= count) break;
        n++;
        push(s);
      }
    }
    return out;
  }
  const firstI =
    freq === "DAILY" ? Math.floor(gapDays / interval) :
    freq === "WEEKLY" ? Math.floor(gapDays / 7 / interval) :
    freq === "MONTHLY" ? Math.max(0, Math.floor(gapDays / 31 / interval) - 1) :
    freq === "YEARLY" ? Math.max(0, Math.floor(gapDays / 366 / interval) - 1) : 0;
  for (let i = firstI; i < firstI + MAX_OCCURRENCES && n < count; i++) {
    let day: string | null;
    if (freq === "DAILY") day = addDays(start.day, i * interval);
    else if (freq === "WEEKLY") day = addDays(start.day, i * interval * 7);
    else if (freq === "MONTHLY") day = addMonths(start.day, i * interval);
    else if (freq === "YEARLY") day = addMonths(start.day, i * interval * 12);
    else {
      push(start.ms); // unsupported rule: at least block the first one
      return out;
    }
    if (!day) continue;
    const s = at(day);
    if (s > until || s > to) break;
    n++;
    push(s);
  }
  return out;
}

// Busy ranges between `from` and `to` (ms). `tz` is the mentor's zone,
// used for all-day events and times without a zone.
export function parseIcalBusy(text: string, tz: string, from: number, to: number): Interval[] {
  const lines = unfold(text);
  const busy: Interval[] = [];
  let ev: Prop[] | null = null;
  let depth = 0; // skip nested blocks such as VALARM
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      ev = [];
      depth = 0;
      continue;
    }
    if (!ev) continue;
    if (line.startsWith("BEGIN:")) {
      depth++;
      continue;
    }
    if (line.startsWith("END:") && line !== "END:VEVENT") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (line === "END:VEVENT") {
      const props = ev;
      ev = null;
      const get = (n: string) => props.find((p) => p.name === n);
      if (get("TRANSP")?.value.toUpperCase() === "TRANSPARENT") continue;
      if (get("STATUS")?.value.toUpperCase() === "CANCELLED") continue;
      const dtstart = get("DTSTART");
      if (!dtstart) continue;
      const start = parseWhen(dtstart, tz);
      if (!start) continue;
      let durMs = 0;
      const dtend = get("DTEND");
      const dur = get("DURATION");
      if (dtend) {
        const end = parseWhen(dtend, tz);
        if (end) {
          // All-day: end is the (exclusive) next day, in the mentor's zone.
          durMs = start.allDay ? zonedToUtc(end.day, "00:00", tz).getTime() - start.ms : end.ms - start.ms;
        }
      } else if (dur) {
        durMs = parseDuration(dur.value);
      } else if (start.allDay) {
        durMs = zonedToUtc(addDays(start.day, 1), "00:00", tz).getTime() - start.ms;
      }
      if (durMs <= 0 || durMs > 31 * 86400_000) continue;
      const exdates = new Set<number>();
      for (const p of props.filter((p) => p.name === "EXDATE")) {
        for (const v of p.value.split(",")) {
          const w = parseWhen({ ...p, value: v }, tz);
          if (w) exdates.add(w.ms);
        }
      }
      // A changed single occurrence (RECURRENCE-ID) is its own event; the
      // original slot may still be blocked, which errs on the safe side.
      busy.push(...expand(start, durMs, get("RRULE")?.value || null, exdates, from, to));
      if (busy.length > 20_000) break;
      continue;
    }
    if (depth > 0) continue;
    const p = parseLine(line);
    if (p) ev.push(p);
  }
  busy.sort((a, b) => a.s - b.s);
  return busy;
}
