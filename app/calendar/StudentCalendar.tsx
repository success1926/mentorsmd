"use client";

// The student's Calendar (student area v2, Oct 2026): upcoming calls with
// Join (today's), Reschedule / Cancel for package calls until 24 hours
// before, Cancel only for free intro calls (then book a new time from the
// mentor's profile); past calls collapsed. On the side: adding the calls to
// their own calendar app (moved here from /account), reminders and a note
// about calls.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Booker } from "@/components/Booker";
import { CalendarSync } from "@/components/CalendarSync";
import { notifyPackagesChanged } from "@/components/StudentShell";
import { CANCEL_CUTOFF_HOURS, JOIN_OPENS_MINUTES_BEFORE, RECORDING_NOTICE, canChangeOnline, fmtDateTime, joinState } from "@/lib/calls";
import { browserTimeZone } from "@/lib/tz";

const fmtTime = (d: string | Date, zone = false) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...(zone ? { timeZoneName: "short" } : {}) });
const minutesOf = (c: any) => Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60_000);
const isToday = (d: Date) => d.toDateString() === new Date().toDateString();

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function DateBadge({ d }: { d: Date }) {
  return (
    <span className="cal-date" aria-hidden="true">
      <span className="small text-secondary">{isToday(d) ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}</span>
      <b>{d.getDate()}</b>
      <span className="small text-muted">{d.toLocaleDateString(undefined, { month: "short" })}</span>
    </span>
  );
}

function UpcomingCall({ c, now, onChanged }: { c: any; now: Date; onChanged: () => void }) {
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const start = new Date(c.startTime);
  const intro = c.kind === "INTRO";
  const state = joinState(c, now);
  const changeable = canChangeOnline(c, now);
  const changeUntil = new Date(start.getTime() - CANCEL_CUTOFF_HOURS * 3600_000);
  const mins = minutesOf(c);
  const first = (c.withName || "your mentor").split(" ")[0];

  async function cancel() {
    if (!confirm(intro ? `Cancel your intro call with ${first}? You can book a new time from their profile.` : `Cancel this call with ${first}? You'll both get an email, and the hours go back to your package.`)) return;
    setBusy(true);
    setErr("");
    const res = intro
      ? await fetch(`/api/intro-calls/${c.id}`, { method: "DELETE" })
      : await fetch(`/api/orders/${c.orderId}/calls`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: c.id }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't cancel the call. Please try again.");
    notifyPackagesChanged();
    onChanged();
  }

  async function move(startIso: string) {
    const res = await fetch(`/api/orders/${c.orderId}/calls`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: c.id, startTime: startIso }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Couldn't move the call.";
    setMoving(false);
    onChanged();
    return null;
  }

  return (
    <div className="cal-item">
      <DateBadge d={start} />
      <div className="stack-sm grow" style={{ gap: 2, minWidth: 200 }}>
        <span className="row-wrap" style={{ gap: 8 }}>
          <b>{intro ? "Intro call" : "Call"} with {c.withName} · {mins} min</b>
          {intro && <span className="badge badge-blue">Free intro call</span>}
        </span>
        <span className="text-secondary small">
          {fmtTime(c.startTime)} to {fmtTime(c.endTime, true)} · {intro ? "No package yet" : c.title}
        </span>
        <span className={`small ${state === "open" ? "" : "text-muted"}`} style={state === "open" ? { color: "var(--success-fg)", fontWeight: 600 } : undefined}>
          {state === "open"
            ? "Room is open. Join now."
            : `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before${changeable ? ` · Change until ${fmtDateTime(changeUntil)}` : ""}`}
        </span>
        {!changeable && state !== "open" && (
          <span className="text-muted small">Less than {CANCEL_CUTOFF_HOURS} hours to go: message {first} if something comes up.</span>
        )}
        {err && <div role="alert" className="alert alert-danger small">{err}</div>}
      </div>
      <div className="row-wrap" style={{ gap: 6 }}>
        <Link href={`/calls/${c.id}`} className={`btn btn-sm ${state === "open" ? "btn-deep" : ""}`}>{state === "open" ? "Join call" : "Call page"}</Link>
        {changeable && !intro && !c.disputed && c.orderId && (
          <button className="btn btn-sm" aria-expanded={moving} onClick={() => setMoving((m) => !m)}>Reschedule</button>
        )}
        {changeable && (
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }} disabled={busy} onClick={cancel}>Cancel</button>
        )}
      </div>
      {moving && (
        <div style={{ flexBasis: "100%" }}>
          <Booker
            framed
            slotsUrl={`/api/orders/${c.orderId}/slots?exclude=${encodeURIComponent(c.id)}`}
            mentor={{ id: c.withId, name: c.withName || "Your mentor", photoUrl: c.withPhotoUrl }}
            title="Reschedule the call"
            description={<>Now: {fmtDateTime(c.startTime)}. Pick a new time; you&apos;ll both get an email with the updated calendar invite.</>}
            confirmLabel="Move here"
            onConfirm={move}
            onCancel={() => setMoving(false)}
            emptyHint={<>Message {first} to agree a time.</>}
          />
        </div>
      )}
    </div>
  );
}

export function StudentCalendar({ data, reload }: { data: any; reload: () => void }) {
  const now = useNow();
  const tz = browserTimeZone();
  const upcoming: any[] = data.upcoming || [];
  const past: any[] = data.past || [];

  useEffect(() => {
    if (window.location.hash === "#calendar-sync") document.getElementById("calendar-sync")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="page stack-lg" style={{ gap: 24, maxWidth: 1180 }}>
      <div className="stack-sm">
        <h1 className="page-title">Calendar</h1>
        <p className="lede">Your calls with mentors.{tz ? ` Times are in ${tz.replace(/_/g, " ")}.` : ""}</p>
      </div>

      <div className="mentor-home-grid student-cal-grid">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section className="mentor-box">
            <div className="mentor-box-head" style={{ flexWrap: "wrap" }}>
              <h2>Upcoming · {upcoming.length}</h2>
              <span className="text-muted small">Reschedule or cancel up to {CANCEL_CUTOFF_HOURS} hours before a call</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="stack-sm" style={{ padding: "8px 0" }}>
                <b>Nothing coming up.</b>
                <span className="text-muted small">Calls you book from a package, and free intro calls, show here.</span>
                <span className="row-wrap">
                  <Link href="/orders" className="btn btn-sm">My packages</Link>
                  <Link href="/mentors" className="btn btn-sm btn-ghost">Find a mentor</Link>
                </span>
              </div>
            ) : (
              upcoming.map((c) => <UpcomingCall key={c.id} c={c} now={now} onChanged={reload} />)
            )}
          </section>

          {past.length > 0 && (
            <details className="collapse">
              <summary>Past calls <span className="tab-count" style={{ marginRight: "auto", marginLeft: 8 }}>{past.length}</span></summary>
              <div className="collapse-body" style={{ gap: 0 }}>
                {past.map((c: any) => (
                  <Link key={c.id} href={c.orderId ? `/orders/${c.orderId}` : `/calls/${c.id}`} className="list-row">
                    <span className="grow">
                      <b style={{ fontSize: 15 }}>{c.kind === "INTRO" ? "Intro call" : "Call"} with {c.withName}</b>
                      <span className="text-muted small" style={{ display: "block" }}>{fmtDateTime(c.startTime)} · {c.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section id="calendar-sync" className="mentor-box" style={{ scrollMarginTop: 100 }}>
            <CalendarSync isMentor={false} />
          </section>
          <section className="mentor-box" style={{ gap: 6 }}>
            <div className="mentor-box-head"><h2>Reminders</h2></div>
            <span className="text-secondary small">
              We email you at 8am on the day of a call, in your time zone{data.timeZone ? ` (${String(data.timeZone).replace(/_/g, " ")})` : ""}, and again 1 hour before.
            </span>
            <Link href="/account#time-zone" className="link small">Change time zone in Settings</Link>
          </section>
          <section className="mentor-box" style={{ gap: 6 }}>
            <div className="mentor-box-head"><h2>About calls</h2></div>
            <span className="text-secondary small">Calls happen in a private MentorsMD video room. {RECORDING_NOTICE}</span>
          </section>
        </div>
      </div>
    </div>
  );
}
