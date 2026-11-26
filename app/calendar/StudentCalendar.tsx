"use client";

// The student's Calendar (student area v2, Oct 2026): upcoming calls with
// Join (today's), Reschedule / Cancel for package calls until 24 hours
// before (after that Reschedule only, with a reason), Cancel only for free
// intro calls (then book a new time from the mentor's profile); past calls collapsed. On the side: adding the calls to
// their own calendar app (moved here from /account), reminders and a note
// about calls.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Booker } from "@/components/Booker";
import { CalendarSync } from "@/components/CalendarSync";
import { LateReasonField, useMoveCall } from "@/components/Calls";
import { notifyPackagesChanged } from "@/components/StudentShell";
import { CANCEL_CUTOFF_HOURS, JOIN_OPENS_MINUTES_BEFORE, RECORDING_NOTICE, canChangeOnline, isLateChange, joinState } from "@/lib/calls";
import { browserTimeZone } from "@/lib/tz";
import { useConfirm } from "@/components/ConfirmDialog";
import { DateBadge } from "@/components/DateBadge";
import { Alert, Collapsible, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { firstName, fmtDateTime, fmtTime } from "@/lib/format";

const minutesOf = (c: any) => Math.round((new Date(c.endTime).getTime() - new Date(c.startTime).getTime()) / 60_000);

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// Loads the calendar (/api/me/calendar) and shows it.
export function StudentCalendarPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  function load() {
    fetch("/api/me/calendar")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setError(d.error || "Couldn't load your calendar");
        else setData(d);
      })
      .catch(() => setError("Couldn't load your calendar"));
  }
  useEffect(load, []);
  if (error) return <div className="page"><Alert tone="danger">{error}</Alert></div>;
  if (!data) return <div className="page"><LoadingBlock lines={3} cards={2} /></div>;
  return <StudentCalendar data={data} reload={load} />;
}

function UpcomingCall({ c, now, onChanged }: { c: any; now: Date; onChanged: () => void }) {
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const start = new Date(c.startTime);
  const intro = c.kind === "INTRO";
  const state = joinState(c, now);
  const changeable = canChangeOnline(c, now);
  // Package calls can still be moved in the last 24 hours, with a reason.
  const late = !intro && isLateChange(c, now);
  const changeUntil = new Date(start.getTime() - CANCEL_CUTOFF_HOURS * 3600_000);
  const mins = minutesOf(c);
  const first = firstName(c.withName) || "your mentor";
  const { confirm, dialog } = useConfirm();

  async function cancel() {
    const ok = await confirm({
      title: intro ? `Cancel your intro call with ${first}?` : `Cancel this call with ${first}?`,
      body: intro ? "You can book a new time from their profile." : "You'll both get an email, and the hours go back to your package.",
      confirmLabel: "Cancel the call",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!ok) return;
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

  const mover = useMoveCall(c.orderId, c.id, late, () => {
    setMoving(false);
    onChanged();
  });

  return (
    <div className="cal-item">
      {dialog}
      <DateBadge d={start} />
      <div className="stack-sm grow" style={{ gap: 2, minWidth: 200 }}>
        <span className="row-wrap" style={{ gap: 8 }}>
          <b>{intro ? "Intro call" : "Call"} with {c.withName} · {mins} min</b>
          {intro && <span className="badge badge-blue">Free intro call</span>}
        </span>
        <span className="text-secondary small">
          {fmtTime(c.startTime)} to {fmtTime(c.endTime, { zone: true })} · {intro ? "No package yet" : c.title}
        </span>
        <span className={`small ${state === "open" ? "" : "text-muted"}`} style={state === "open" ? { color: "var(--success-fg)", fontWeight: 600 } : undefined}>
          {state === "open"
            ? "Room is open. Join now."
            : `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before${changeable ? ` · Change until ${fmtDateTime(changeUntil)}` : ""}`}
        </span>
        {!changeable && state !== "open" && (
          <span className="text-muted small">
            {late && c.orderId && !c.disputed
              ? `Less than ${CANCEL_CUTOFF_HOURS} hours to go: it can't be cancelled on the site, and moving it needs a short reason that's sent to ${first}.`
              : `Less than ${CANCEL_CUTOFF_HOURS} hours to go: message ${first} if something comes up.`}
          </span>
        )}
        {err && <Alert tone="danger" className="small">{err}</Alert>}
      </div>
      <div className="row-wrap" style={{ gap: 6 }}>
        <Link href={`/calls/${c.id}`} className={`btn btn-sm ${state === "open" ? "btn-primary" : ""}`}>{state === "open" ? "Join call" : "Call page"}</Link>
        {(changeable || late) && !intro && !c.disputed && c.orderId && (
          <button className="btn btn-sm toggle-btn" aria-expanded={moving} aria-controls={`move-${c.id}`} onClick={() => setMoving((m) => !m)}>Reschedule</button>
        )}
        {changeable && (
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--danger)" }} disabled={busy} onClick={cancel}>Cancel</button>
        )}
      </div>
      {moving && (
        <div id={`move-${c.id}`} className="stack" style={{ flexBasis: "100%" }}>
          {late && <LateReasonField otherFirst={first} reason={mover.reason} setReason={mover.setReason} />}
          <Booker
            framed
            slotsUrl={`/api/orders/${c.orderId}/slots?exclude=${encodeURIComponent(c.id)}`}
            mentor={{ id: c.withId, name: c.withName || "Your mentor", photoUrl: c.withPhotoUrl }}
            title="Reschedule the call"
            description={<>Now: {fmtDateTime(c.startTime)}. Pick a new time; you&apos;ll both get an email with the updated calendar invite.</>}
            confirmLabel="Move here"
            onConfirm={mover.move}
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
    <div className="page stack-lg" style={{ gap: 24 }}>
      <PageHeader title="Calendar" lede={`Your calls with mentors.${tz ? ` Times are in ${tz.replace(/_/g, " ")}.` : ""}`} />

      <div className="mentor-home-grid student-cal-grid">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section className="mentor-box">
            <div className="mentor-box-head" style={{ flexWrap: "wrap" }}>
              <h2>Upcoming <span className="tab-count">{upcoming.length}</span></h2>
              <span className="text-muted small">Reschedule or cancel up to {CANCEL_CUTOFF_HOURS} hours before a call. After that, moving it needs a short reason.</span>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing coming up"
                action={
                  <span className="row-wrap" style={{ justifyContent: "center" }}>
                    <Link href="/orders" className="btn btn-sm">My packages</Link>
                    <Link href="/mentors" className="btn btn-sm btn-ghost">Find a mentor</Link>
                  </span>
                }
              >
                Calls you book from a package, and free intro calls, show here.
              </EmptyState>
            ) : (
              upcoming.map((c) => <UpcomingCall key={c.id} c={c} now={now} onChanged={reload} />)
            )}
          </section>

          {past.length > 0 && (
            <Collapsible title="Past calls" count={past.length} bodyClassName="past-calls">
              {past.map((c: any) => (
                <Link key={c.id} href={c.orderId ? `/orders/${c.orderId}` : `/calls/${c.id}`} className="list-row">
                  <span className="grow stack-sm" style={{ gap: 0 }}>
                    <b>{c.kind === "INTRO" ? "Intro call" : "Call"} with {c.withName}</b>
                    <span className="text-muted small">{fmtDateTime(c.startTime)} · {c.title}</span>
                  </span>
                </Link>
              ))}
            </Collapsible>
          )}
        </div>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section id="calendar-sync" className="mentor-box" style={{ scrollMarginTop: 100 }}>
            <CalendarSync />
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
