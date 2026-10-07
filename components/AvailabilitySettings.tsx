"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { BUFFER_OPTIONS, BUSY_KINDS, NOTICE_OPTIONS, WEEKDAY_NAMES, WeeklyHours } from "@/lib/schedule";
import { browserTimeZone, fmtDayLabel, timeZoneList } from "@/lib/tz";

type Msg = { ok: boolean; text: string } | null;

function Note({ m }: { m: Msg }) {
  if (!m) return null;
  return <div role="status" className={`alert ${m.ok ? "alert-success" : "alert-danger"}`}>{m.text}</div>;
}

const zoneLabel = (z: string) => z.replace(/_/g, " ");

export function TimeZoneSelect({ value, onChange, id }: { value: string; onChange: (tz: string) => void; id?: string }) {
  const zones = useMemo(() => {
    const list = timeZoneList();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginBottom: 0, maxWidth: 360 }}>
      {!value && <option value="">Choose your time zone</option>}
      {zones.map((z) => (
        <option key={z} value={z}>{zoneLabel(z)}</option>
      ))}
    </select>
  );
}

// Everyone: the time zone used for reminders and emails.
export function TimeZoneCard({ initial, onSaved }: { initial: string | null; onSaved?: () => void }) {
  const [tz, setTz] = useState(initial || "");
  const [msg, setMsg] = useState<Msg>(null);
  const detected = browserTimeZone();
  async function save(value: string) {
    setMsg(null);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeZone: value }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Time zone saved." } : { ok: false, text: d.error || "Couldn't save" });
    if (res.ok) onSaved?.();
  }
  return (
    <div className="stack-sm">
      <label className="field-label" htmlFor="tz-select">Your time zone</label>
      <span className="text-secondary small">Used for call reminders (8am on the day of a call) and the times in our emails. The site itself shows times in your device&apos;s time zone.</span>
      <div className="row-wrap">
        <TimeZoneSelect id="tz-select" value={tz} onChange={setTz} />
        <button className="btn btn-primary btn-sm" disabled={!tz || tz === initial} onClick={() => save(tz)}>Save</button>
        {detected && detected !== tz && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setTz(detected); save(detected); }}>Use {zoneLabel(detected)}</button>
        )}
      </div>
      <Note m={msg} />
    </div>
  );
}

// ---------- Mentor: weekly call hours ----------

const DEFAULT_WINDOW: [string, string] = ["18:00", "21:00"];

export function CallHoursCard({ profile, onSaved }: { profile: any; onSaved?: () => void }) {
  const [hours, setHours] = useState<WeeklyHours>(() => (profile.weeklyHours as WeeklyHours) || {});
  const [tz, setTz] = useState<string>(profile.timeZone || browserTimeZone() || "America/New_York");
  const [buffer, setBuffer] = useState<number>(profile.bufferMinutes ?? 15);
  const [notice, setNotice] = useState<number>(profile.minNoticeHours ?? 24);
  const [daysOff, setDaysOff] = useState<string[]>(profile.daysOff || []);
  const [newOff, setNewOff] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const today = new Date().toISOString().slice(0, 10);

  const setDay = (d: number, windows: [string, string][]) =>
    setHours((h) => {
      const next = { ...h };
      if (windows.length) next[String(d)] = windows;
      else delete next[String(d)];
      return next;
    });

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/profile/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyHours: hours, timeZone: tz, bufferMinutes: buffer, minNoticeHours: notice, daysOff }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save" });
    setMsg({ ok: true, text: d.hasAvailability ? "Saved. Students can now book calls in these hours." : "Saved. Add at least one block of hours so students can book calls." });
    onSaved?.();
  }

  return (
    <section id="call-hours" className="card stack" style={{ scrollMarginTop: 100, gap: 18 }}>
      <div className="stack-sm">
        <h2 style={{ fontSize: 26 }}>Call availability</h2>
        <span className="text-secondary">
          When students can book the calls in your packages. They only see open times after they&apos;ve paid, and every call happens in a private MentorsMD video room.
        </span>
      </div>

      <div className="stack-sm">
        <span className="field-label">Weekly hours</span>
        <div>
          {WEEKDAY_NAMES.map((name, d) => {
            const windows = hours[String(d)] || [];
            return (
              <div key={d} className="hours-row">
                <label className="check" style={{ paddingTop: 8 }}>
                  <input type="checkbox" checked={windows.length > 0} onChange={(e) => setDay(d, e.target.checked ? [DEFAULT_WINDOW] : [])} />
                  <b>{name}</b>
                </label>
                <div className="stack-sm">
                  {windows.length === 0 && <span className="text-muted" style={{ paddingTop: 8 }}>Unavailable</span>}
                  {windows.map((w, i) => (
                    <div key={i} className="row-wrap" style={{ gap: 8 }}>
                      <input type="time" step={1800} className="input time-input" value={w[0]} aria-label={`${name} from`}
                        onChange={(e) => setDay(d, windows.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) as [string, string][])} />
                      <span className="text-muted">to</span>
                      <input type="time" step={1800} className="input time-input" value={w[1]} aria-label={`${name} until`}
                        onChange={(e) => setDay(d, windows.map((x, j) => (j === i ? [x[0], e.target.value] : x)) as [string, string][])} />
                      <button type="button" className="btn btn-ghost btn-sm" aria-label="Remove these hours" onClick={() => setDay(d, windows.filter((_, j) => j !== i))}>
                        <Icon d={ICONS.x} size={16} />
                      </button>
                      {i === windows.length - 1 && windows.length < 4 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDay(d, [...windows, [w[1] < "22:00" ? w[1] : "09:00", w[1] < "22:00" ? "23:00" : "10:00"]])}>
                          + Add hours
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2">
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="avail-tz">Time zone for these hours</label>
          <TimeZoneSelect id="avail-tz" value={tz} onChange={setTz} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="avail-notice">Minimum notice</label>
          <select id="avail-notice" className="input" value={notice} onChange={(e) => setNotice(Number(e.target.value))} style={{ marginBottom: 0 }}>
            {NOTICE_OPTIONS.map((h) => <option key={h} value={h}>{h} hours ahead</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" htmlFor="avail-buffer">Break between calls</label>
          <select id="avail-buffer" className="input" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} style={{ marginBottom: 0 }}>
            {BUFFER_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? "No break" : `${m} minutes`}</option>)}
          </select>
        </div>
      </div>

      <div className="stack-sm">
        <span className="field-label">Days off</span>
        <span className="text-secondary small">Single days with no calls (a holiday, an exam day). For longer stretches, or to block due dates too, use Busy dates below.</span>
        <div className="row-wrap">
          <input type="date" className="input time-input" min={today} value={newOff} onChange={(e) => setNewOff(e.target.value)} aria-label="Day off" />
          <button type="button" className="btn btn-sm" disabled={!newOff || daysOff.includes(newOff)} onClick={() => { setDaysOff((d) => [...d, newOff].sort()); setNewOff(""); }}>Add day off</button>
        </div>
        {daysOff.length > 0 && (
          <div className="row-wrap">
            {daysOff.map((d) => (
              <span key={d} className="badge badge-brand row" style={{ gap: 6 }}>
                {fmtDayLabel(d)}
                <button type="button" className="link-btn" aria-label={`Remove ${d}`} onClick={() => setDaysOff((x) => x.filter((y) => y !== d))}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="row-wrap">
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save availability"}</button>
        <Link href="/calendar" className="btn">My calendar</Link>
      </div>
      <Note m={msg} />
    </section>
  );
}

// ---------- Mentor: busy dates ----------

export function BusyDatesCard() {
  const [list, setList] = useState<any[] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState("NO_DEADLINES");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [clashes, setClashes] = useState<{ deadlines: any[]; calls: any[] } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/profile/busy-dates").then((r) => r.json()).then((d) => setList(d.busyDates || [])).catch(() => setList([]));
  }, []);

  async function add() {
    setSaving(true);
    setMsg(null);
    setClashes(null);
    const res = await fetch("/api/profile/busy-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDay: start, endDay: end || start, kind, note }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't add those dates" });
    setList(d.busyDates || []);
    setStart("");
    setEnd("");
    setNote("");
    if (d.clashes?.deadlines?.length || d.clashes?.calls?.length) setClashes(d.clashes);
    else setMsg({ ok: true, text: "Busy dates added." });
  }

  async function remove(id: string) {
    const res = await fetch("/api/profile/busy-dates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setList(d.busyDates || []);
  }

  return (
    <section id="busy-dates" className="card stack" style={{ scrollMarginTop: 100 }}>
      <div className="stack-sm">
        <h2 style={{ fontSize: 26 }}>Busy dates</h2>
        <span className="text-secondary">
          Exams, rotations, travel? Students can&apos;t pick a due date on these days, and you can block calls too. Your note is private: students only see that the dates aren&apos;t available. Orders you already have keep their due dates.
        </span>
      </div>
      <div className="grid-2">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">From</span>
          <input type="date" className="input" min={today} value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }} />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">To (same day for one day)</span>
          <input type="date" className="input" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">What these dates block</span>
        <div className="seg">
          {BUSY_KINDS.map((k) => (
            <button type="button" key={k.value} className="seg-opt" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</button>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">Private note (optional)</span>
        <input className="input" maxLength={200} placeholder="e.g. Step 1 exam week" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!start || saving} onClick={add}>{saving ? "Adding…" : "Add busy dates"}</button>
      <Note m={msg} />
      {clashes && (
        <div role="alert" className="alert alert-warning stack-sm">
          <b>Saved, but these overlap work you already have:</b>
          {clashes.deadlines.map((c: any) => (
            <Link key={`d${c.orderId}`} href={`/orders/${c.orderId}`} className="link small">
              {c.gigTitle} for {c.studentName} is due {fmtDayLabel(c.dueDay)}
            </Link>
          ))}
          {clashes.calls.map((c: any, i: number) => (
            <Link key={`c${i}`} href={`/orders/${c.orderId}`} className="link small">
              Call with {c.studentName} on {new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Link>
          ))}
          <span className="small">Those keep their dates. Deliver early, or message the student and change the due date (or move the call) on the order.</span>
        </div>
      )}
      {list && list.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)" }}>
          {list.map((b) => (
            <div key={b.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{fmtDayLabel(b.startDay)}{b.endDay !== b.startDay ? ` to ${fmtDayLabel(b.endDay)}` : ""}</b>
                {b.note && <span className="text-muted">{b.note}</span>}
              </div>
              <span className={`badge ${b.kind === "NO_DEADLINES_NO_CALLS" ? "badge-warning" : ""}`}>{BUSY_KINDS.find((k) => k.value === b.kind)?.label}</span>
              <button className="btn btn-sm" onClick={() => remove(b.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Mentor: block times from their own calendar ----------

export function ExternalCalendarCard({ profile, onChanged }: { profile: any; onChanged?: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const connected = profile.externalCal;

  async function call(method: "POST" | "DELETE", body?: any, okText?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile/external-calendar", {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: d.error || "Couldn't read that calendar" });
    else {
      setMsg({ ok: true, text: okText || `Connected. ${d.busyCount} busy time${d.busyCount === 1 ? "" : "s"} found in the next 60 days.` });
      setUrl("");
    }
    onChanged?.();
  }

  return (
    <div className="card card-tint stack" style={{ padding: 20 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <b className="row"><Icon d={ICONS.calendar} size={18} /> Block busy times from your own calendar</b>
        {connected ? <span className="badge badge-success">Connected</span> : <span className="badge">Not connected</span>}
      </div>
      <span className="text-secondary small">
        Paste your calendar&apos;s secret address and we&apos;ll hide times you&apos;re busy from the slot picker (checked every 15 minutes). We only read busy times; event names aren&apos;t stored and nothing is added to your calendar.
      </span>
      <details className="collapse">
        <summary style={{ fontSize: 15 }}>Where do I find the secret address?</summary>
        <div className="collapse-body">
          <ol className="text-secondary small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li><b>Google Calendar</b> (on a computer): Settings → click your calendar on the left → Integrate calendar → copy <i>Secret address in iCal format</i>.</li>
            <li><b>iCloud</b>: in the Calendar app, share the calendar as a <i>Public Calendar</i> and copy the link (it starts with webcal://).</li>
            <li><b>Outlook</b>: Settings → Calendar → Shared calendars → Publish a calendar → copy the ICS link.</li>
          </ol>
          <span className="text-muted small">Keep this address private, like a password. You can disconnect it here at any time.</span>
        </div>
      </details>
      {connected && (
        <div className="stack-sm small">
          <span>Reading from <b>{connected.host}</b>{profile.externalBusyFetchedAt ? `, last checked ${new Date(profile.externalBusyFetchedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}.</span>
          {profile.externalCalError && <span className="alert alert-warning">Last check failed: {profile.externalCalError}</span>}
          <div className="row-wrap">
            <button className="btn btn-sm" disabled={busy} onClick={() => call("POST", { refresh: true })}>Check now</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} disabled={busy}
              onClick={() => confirm("Stop blocking times from this calendar?") && call("DELETE", undefined, "Disconnected.")}>
              Disconnect
            </button>
          </div>
        </div>
      )}
      <div className="row">
        <input className="input grow" style={{ marginBottom: 0 }} placeholder={connected ? "Paste a new secret address to replace it" : "https://calendar.google.com/calendar/ical/…/basic.ics"} value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Secret calendar address" />
        <button className="btn btn-primary btn-sm" disabled={!url.trim() || busy} onClick={() => call("POST", { url })}>{busy ? "Checking…" : "Connect"}</button>
      </div>
      <Note m={msg} />
    </div>
  );
}
