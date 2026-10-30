"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { initialsOf, tintFor } from "@/components/ui";
import { RECORDING_NOTICE } from "@/lib/calls";
import { bookingWindowFor, bookingWindowLabel } from "@/lib/schedule";
import { addDays, browserTimeZone, dayInZone, fmtDayLabel, isValidTimeZone, timeZoneList, weekdayOfDay } from "@/lib/tz";

// The booking screen students see when they pick a call time, laid out
// like Cal.com's booking page: what the call is on the left, a month
// calendar in the middle (days with open times are bold), and the chosen
// day's times on the right. Pick a time, then press Confirm next to it.
// On a narrow screen the three parts stack.
//
// Only the look is new: open times still come from the same slot
// addresses (intro-slots, call-slots, an order's slots), and confirming
// calls the same booking action the page used before (onConfirm).

type SlotData = { slots: string[]; lengthMinutes: number; hasAvailability: boolean; bookingWindowDays: number };

export type BookerMentor = { id?: string; name: string; photoUrl?: string | null };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const firstName = (n: string) => (n || "").split(" ")[0];

function monthOf(day: string) {
  return day.slice(0, 7);
}
function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

export function Booker({
  slotsUrl,
  mentor,
  title,
  description,
  durationMinutes,
  durations,
  details,
  blocked,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
  onMessage,
  emptyHint,
  noHoursTitle,
  onLoaded,
  framed = false,
}: {
  slotsUrl: string | null; // null: don't load times (e.g. booking isn't possible yet)
  mentor: BookerMentor;
  title: string; // "Free intro call", "Package call"
  description?: React.ReactNode;
  durationMinutes?: number; // shown until the slots say otherwise
  durations?: { options: number[]; value: number; onChange: (m: number) => void };
  details?: React.ReactNode; // extra lines in the left column (hours used, price)
  blocked?: React.ReactNode; // shown instead of the calendar when booking isn't possible
  confirmLabel?: string;
  onConfirm: (startIso: string) => Promise<string | null>; // returns an error message, or null
  onCancel?: () => void;
  onMessage?: () => void; // "Message [mentor]" when there are no times
  emptyHint?: React.ReactNode;
  noHoursTitle?: string; // instead of "[Name] hasn't set their call hours yet" (e.g. for the mentor)
  onLoaded?: (raw: any) => void; // the slot address's whole answer (e.g. packages, pay-per-call), so the page needn't load it again
  framed?: boolean; // a border around it, for use outside a pop-up
}) {
  const [data, setData] = useState<SlotData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [tz, setTz] = useState("");
  const [hour12, setHour12] = useState(true);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [focusDay, setFocusDay] = useState("");
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const timesRef = useRef<HTMLDivElement>(null);
  const first = firstName(mentor.name) || "your mentor";

  // The viewer's zone is only known in the browser.
  useEffect(() => setTz(browserTimeZone() || "UTC"), []);
  const zones = useMemo(() => {
    if (!tz) return [];
    const list = timeZoneList();
    return list.includes(tz) ? list : [tz, ...list];
  }, [tz]);

  // The address of the latest load: an older answer (e.g. for the other
  // call length) that arrives late is ignored.
  const latestUrl = useRef<string | null>(null);
  function load() {
    if (!slotsUrl) return;
    const url = slotsUrl;
    latestUrl.current = url;
    setData(null);
    setLoadError("");
    setPicked("");
    fetch(url)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Couldn't load times");
        if (latestUrl.current !== url) return;
        onLoaded?.(d);
        setData({ slots: d.slots || [], lengthMinutes: d.lengthMinutes || durationMinutes || 30, hasAvailability: !!d.hasAvailability, bookingWindowDays: bookingWindowFor(d.bookingWindowDays) });
      })
      .catch((e) => {
        if (latestUrl.current === url) setLoadError(e.message || "Couldn't load times");
      });
  }
  useEffect(load, [slotsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open times grouped by calendar day in the viewer's zone.
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!tz) return m;
    const zone = isValidTimeZone(tz) ? tz : "UTC";
    for (const s of data?.slots || []) {
      const d = dayInZone(new Date(s), zone);
      m.set(d, [...(m.get(d) || []), s]);
    }
    return m;
  }, [data, tz]);
  const days = useMemo(() => Array.from(byDay.keys()).sort(), [byDay]);
  const today = tz ? dayInZone(new Date(), isValidTimeZone(tz) ? tz : "UTC") : "";

  // First load (or a new zone / length): open on the first day with times.
  useEffect(() => {
    if (!days.length) return;
    if (!day || !byDay.has(day)) {
      setDay(days[0]);
      setMonth(monthOf(days[0]));
      setFocusDay(days[0]);
    }
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const minMonth = today ? monthOf(today) : "";
  const maxMonth = days.length ? monthOf(days[days.length - 1]) : minMonth;

  const cells = useMemo(() => {
    if (!month) return [];
    const firstDay = `${month}-01`;
    const out: (string | null)[] = Array.from({ length: weekdayOfDay(firstDay) }, () => null);
    for (let d = firstDay; monthOf(d) === month; d = addDays(d, 1)) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  function pickDay(d: string) {
    setDay(d);
    setFocusDay(d);
    setPicked("");
    setError("");
    // Stacked (phone) layout: bring the day's times into view.
    requestAnimationFrame(() => {
      const el = timesRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight - 80) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Arrow keys move between days with open times (Cal.com-style grid).
  function onGridKey(e: React.KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step || !focusDay) return;
    e.preventDefault();
    let d = focusDay;
    for (let i = 0; i < 62; i++) {
      d = addDays(d, step);
      if (byDay.has(d)) break;
      if (Math.abs(step) === 7) return; // only straight up/down
      if (d < (days[0] || d) || d > (days[days.length - 1] || d)) return;
    }
    if (!byDay.has(d)) return;
    setFocusDay(d);
    if (monthOf(d) !== month) setMonth(monthOf(d));
  }
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`);
    if (el && gridRef.current?.contains(document.activeElement)) el.focus();
  }, [focusDay, month]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { timeZone: tz || undefined, hour: "numeric", minute: "2-digit", hour12 });

  async function confirm() {
    if (!picked || saving) return;
    setSaving(true);
    setError("");
    const err = await onConfirm(picked);
    // On success the page moves on (or opens Stripe): Confirm stays off so
    // it can't be pressed twice meanwhile.
    if (err) {
      setSaving(false);
      setPicked("");
      setError(err);
      load();
    }
  }

  const length = data?.lengthMinutes || durations?.value || durationMinutes;
  const ready = !!data && !!tz;
  const empty = ready && !data!.slots.length;
  const showCalendar = !blocked && !loadError && !empty;

  // ----- Left: what the call is -----
  const info = (
    <div className="booker-info">
      <div className="row" style={{ gap: 10 }}>
        {mentor.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mentor.photoUrl} alt="" className="avatar" style={{ objectFit: "cover", width: 40, height: 40 }} />
        ) : (
          <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: tintFor(mentor.id || mentor.name) }} aria-hidden="true">{initialsOf(mentor.name)}</span>
        )}
        <span className="text-secondary" style={{ fontWeight: 600 }}>{mentor.name}</span>
      </div>
      <h2 className="booker-title">{title}</h2>
      {description && <div className="booker-desc">{description}</div>}
      <ul className="booker-facts">
        {durations ? (
          <li>
            <ClockIcon />
            <span className="booker-durations" role="radiogroup" aria-label="Call length">
              {durations.options.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={durations.value === m} className="booker-chip" onClick={() => durations.onChange(m)}>
                  {m} min
                </button>
              ))}
            </span>
          </li>
        ) : length ? (
          <li><ClockIcon /> {length} min</li>
        ) : null}
        <li><VideoIcon /> Video: private MentorsMD room</li>
        <li>
          <GlobeIcon />
          {tz ? (
            <label className="booker-tz">
              <span className="sr-only">Show times in this time zone</span>
              <select value={tz} onChange={(e) => { setTz(e.target.value); setPicked(""); }}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select>
            </label>
          ) : (
            <span className="text-muted">Your time zone</span>
          )}
        </li>
      </ul>
      {details && <div className="booker-details">{details}</div>}
      <p className="booker-notice">{RECORDING_NOTICE}</p>
    </div>
  );

  // ----- Middle and right: calendar and times -----
  let body: React.ReactNode;
  if (blocked) {
    body = <div className="booker-msg">{blocked}</div>;
  } else if (loadError) {
    body = (
      <div className="booker-msg">
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="alert alert-danger">{loadError} <button className="link-btn link" onClick={load}>Try again</button></div>
      </div>
    );
  } else if (empty) {
    body = (
      <div className="booker-msg">
        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <div className="alert alert-blue stack-sm">
          <b>{data!.hasAvailability ? `No times available in the next ${bookingWindowLabel(data!.bookingWindowDays)}` : noHoursTitle || `${first} hasn't set their call hours yet`}</b>
          {emptyHint && <span>{emptyHint}</span>}
          <div className="row-wrap">
            {onMessage && <button className="btn btn-sm btn-primary" onClick={onMessage}>Message {first}</button>}
            {onCancel && <button className="btn btn-sm" onClick={onCancel}>Close</button>}
          </div>
        </div>
      </div>
    );
  } else if (!ready) {
    body = (
      <>
        <div className="booker-cal" aria-busy="true" aria-label="Loading open times">
          <div className="booker-skel" style={{ width: 140, height: 20, marginBottom: 18 }} />
          <div className="booker-grid">
            {Array.from({ length: 35 }, (_, i) => <div key={i} className="booker-skel booker-skel-day" />)}
          </div>
        </div>
        <div className="booker-times">
          <div className="booker-skel" style={{ width: 100, height: 18, marginBottom: 14 }} />
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="booker-skel" style={{ height: 42, marginBottom: 8 }} />)}
        </div>
      </>
    );
  } else {
    const [y, m] = month.split("-").map(Number);
    const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    const times = byDay.get(day) || [];
    // One day in the grid takes Tab focus; arrows move from there.
    const inMonth = (d: string) => byDay.has(d) && monthOf(d) === month;
    const tabbable = inMonth(focusDay) ? focusDay : inMonth(day) ? day : days.find((d) => monthOf(d) === month) || "";
    body = (
      <>
        <div className="booker-cal">
          <div className="booker-cal-head">
            <b className="booker-month" aria-live="polite">{monthLabel}</b>
            <span className="row" style={{ gap: 4 }}>
              <button type="button" className="booker-nav" aria-label="Previous month" disabled={month <= minMonth} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
              <button type="button" className="booker-nav" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            </span>
          </div>
          <div className="booker-grid booker-weekdays" aria-hidden="true">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="booker-grid" role="group" aria-label={`Days in ${monthLabel}. Days with open times can be picked.`} ref={gridRef} onKeyDown={onGridKey}>
            {cells.map((d, i) => {
              if (!d) return <span key={`x${i}`} />;
              const open = byDay.has(d);
              const n = Number(d.slice(8));
              const label = `${fmtDayLabel(d, { weekday: "long", month: "long", day: "numeric" })}${open ? `, ${byDay.get(d)!.length} open time${byDay.get(d)!.length === 1 ? "" : "s"}` : ", no open times"}`;
              return (
                <button
                  key={d}
                  type="button"
                  data-day={d}
                  className={`booker-day${open ? " open" : ""}${d === today ? " today" : ""}`}
                  disabled={!open}
                  aria-pressed={d === day}
                  aria-current={d === today ? "date" : undefined}
                  aria-label={label}
                  tabIndex={d === tabbable ? 0 : -1}
                  onFocus={() => open && setFocusDay(d)}
                  onClick={() => pickDay(d)}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
        <div className="booker-times" ref={timesRef}>
          <div className="booker-times-head">
            <b>{day ? fmtDayLabel(day, { weekday: "short", month: "short", day: "numeric" }) : "Pick a day"}</b>
            <span className="booker-hour-toggle" role="radiogroup" aria-label="Clock">
              <button type="button" role="radio" aria-checked={hour12} onClick={() => setHour12(true)}>12h</button>
              <button type="button" role="radio" aria-checked={!hour12} onClick={() => setHour12(false)}>24h</button>
            </span>
          </div>
          <div className="booker-time-list" role="list" aria-label={day ? `Open times on ${fmtDayLabel(day, { weekday: "long", month: "long", day: "numeric" })}` : "Open times"}>
            {times.map((s) =>
              picked === s ? (
                <div key={s} className="booker-time-pair" role="listitem">
                  <button type="button" className="booker-time selected" aria-pressed="true" onClick={() => setPicked("")}>{fmtTime(s)}</button>
                  <button type="button" className="booker-confirm" disabled={saving} onClick={confirm} autoFocus>
                    {saving ? "Booking…" : confirmLabel}
                  </button>
                </div>
              ) : (
                <div key={s} role="listitem">
                  <button type="button" className="booker-time" aria-pressed="false" disabled={saving} onClick={() => { setPicked(s); setError(""); }}>
                    <span className="booker-dot" aria-hidden="true" />
                    {fmtTime(s)}
                  </button>
                </div>
              )
            )}
          </div>
          {error && <div role="alert" className="alert alert-danger small" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      </>
    );
  }

  return (
    <div className={`booker${framed ? " booker-framed" : ""}`}>
      <div className={`booker-layout${showCalendar ? "" : " booker-layout-msg"}`}>
        {info}
        {body}
      </div>
      {onCancel && showCalendar && (
        <div className="booker-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
