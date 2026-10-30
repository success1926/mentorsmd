"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { Booker } from "@/components/Booker";
import {
  BookingLike,
  CANCEL_CUTOFF_HOURS,
  JOIN_OPENS_MINUTES_BEFORE,
  RECORDING_NOTICE,
  callHeld,
  callSummary,
  LATE_REASON_MAX,
  LATE_REASON_MIN,
  canChangeOnline,
  fmtDateTime,
  isLateChange,
  joinState,
} from "@/lib/calls";
import { NEEDS_ADMIN, outcomeLabel } from "@/lib/callOutcomes";

// Re-render every 30s so the Join button switches on at the right time.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

async function callApi(orderId: string, method: "POST" | "PATCH" | "DELETE", body: any): Promise<string | null> {
  const res = await fetch(`/api/orders/${orderId}/calls`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? null : data.error || "Something went wrong";
}

const fmtTime = (d: string | Date) => new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Moving a package call. With less than 24 hours to go it needs a reason,
// which is sent to the other person as a message (and quoted in the
// "Call moved" email). A message warning (e.g. off-site contact) is shown
// once; picking the time again sends it anyway, like the message box.
export function useMoveCall(orderId: string, bookingId: string, late: boolean, onMoved: () => void) {
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const reasonOk = !late || reason.trim().length >= LATE_REASON_MIN;
  async function move(startIso: string): Promise<string | null> {
    if (!reasonOk) return `Please explain why you need to move the call (at least ${LATE_REASON_MIN} characters).`;
    const res = await fetch(`/api/orders/${orderId}/calls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, startTime: startIso, ...(late ? { reason: reason.trim(), acknowledgeWarnings: ack } : {}) }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setReason("");
      setAck(false);
      onMoved();
      return null;
    }
    if (d.code === "WARNING" && Array.isArray(d.warnings)) {
      setAck(true);
      return `${d.warnings.map((w: any) => w.text).join(" ")} Pick the time again to send it anyway.`;
    }
    return d.error || "Couldn't move the call.";
  }
  return { reason, setReason, reasonOk, move };
}

// The reason box shown above the time picker for a late move.
export function LateReasonField({ otherFirst, reason, setReason }: { otherFirst: string; reason: string; setReason: (v: string) => void }) {
  const left = LATE_REASON_MIN - reason.trim().length;
  return (
    <label className="field" style={{ marginBottom: 0 }}>
      <span className="field-label">Why do you need to move it?</span>
      <span className="text-secondary small">
        The call is less than {CANCEL_CUTOFF_HOURS} hours away, so moving it needs a short explanation. It&apos;s sent to {otherFirst} as a message with the new time.
      </span>
      <textarea
        className="input"
        rows={3}
        maxLength={LATE_REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. My clinical shift was moved to that afternoon."
      />
      {left > 0 && <span className="text-muted small">{left} more character{left === 1 ? "" : "s"} needed</span>}
    </label>
  );
}

// Who joined a call and when (from Daily). Shown on the order page and to admins.
export function Attendance({ booking, order }: { booking: any; order: any }) {
  const rows: any[] = booking.attendance || [];
  if (!rows.length) return <span className="text-muted small">No one joined through MentorsMD.</span>;
  const who = (a: any) =>
    a.userId === order.buyerId ? `${order.buyer?.name || "Student"} (student)` : a.userId === order.sellerId ? `${order.seller?.name || "Mentor"} (mentor)` : a.name || "Guest";
  return (
    <ul className="small text-secondary" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
      {rows.map((a) => (
        <li key={a.id}>
          {who(a)}: joined {fmtTime(a.joinedAt)}
          {a.leftAt ? `, left ${fmtTime(a.leftAt)}` : ""}
          {a.durationSec ? ` (${Math.max(1, Math.round(a.durationSec / 60))} min)` : ""}
        </li>
      ))}
    </ul>
  );
}

// Recordings of a call, with a "Watch recording" button that fetches a
// short-lived link from Daily. Admins by default; mentors on their own
// hours packages pass watchUrl (/api/orders/[id]/recordings/[recId]).
export function Recordings({ booking, watchUrl }: { booking: any; watchUrl?: (recordingId: string) => string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const recs: any[] = booking.recordings || [];
  if (!recs.length) return <span className="text-muted small">No recording.</span>;
  async function watch(id: string) {
    const tab = window.open("", "_blank");
    setBusy(id);
    const res = await fetch(watchUrl ? watchUrl(id) : `/api/admin/recordings/${id}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok && d.url) {
      if (tab) tab.location.href = d.url;
      else window.location.href = d.url;
    } else {
      tab?.close();
      alert(d.error || "Couldn't open the recording");
    }
  }
  return (
    <div className="row-wrap">
      {recs.map((r, i) =>
        r.deletedAt ? (
          <span key={r.id} className="badge">Recording {i + 1} deleted</span>
        ) : r.status === "ready" ? (
          <button key={r.id} className="btn btn-sm" disabled={busy === r.id} onClick={() => watch(r.id)}>
            <Icon d={ICONS.video} size={16} /> Watch recording{recs.length > 1 ? ` ${i + 1}` : ""}
            {r.durationSec ? ` (${Math.max(1, Math.round(r.durationSec / 60))} min)` : ""}
          </button>
        ) : (
          <span key={r.id} className="badge">{r.status === "error" ? "Recording failed" : "Recording processing"}</span>
        )
      )}
    </div>
  );
}

export function CallRow({
  booking,
  order,
  canManage,
  isSeller,
  isAdmin,
  blocked,
  onChanged,
}: {
  booking: BookingLike & any;
  order: any;
  canManage: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  // One of them blocked the other: the call can be cancelled any time.
  blocked?: boolean;
  onChanged?: () => void;
}) {
  const now = useNow();
  const state = joinState(booking, now);
  const changeable = canChangeOnline(booking, now);
  const late = isLateChange(booking, now);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [err, setErr] = useState("");
  const studentFirst = (order.buyer?.name || "the student").split(" ")[0];
  const otherFirst = isSeller ? studentFirst : (order.seller?.name || "your mentor").split(" ")[0];
  const mover = useMoveCall(order.id, booking.id, late, () => {
    setMoving(false);
    onChanged?.();
  });

  async function cancel() {
    if (!confirm("Cancel this call? You'll both get an email, and the call goes back to unbooked.")) return;
    setBusy(true);
    setErr("");
    const e = await callApi(order.id, "DELETE", { bookingId: booking.id });
    setBusy(false);
    if (e) setErr(e);
    else onChanged?.();
  }

  const move = mover.move;

  return (
    <div className="stack-sm">
      <div className="call-row">
        <Icon d={ICONS.video} />
        <div className="stack-sm grow" style={{ gap: 2 }}>
          <b>{fmtDateTime(booking.startTime)} to {fmtTime(booking.endTime)}</b>
          <span className="text-muted">
            {state === "early" && `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before the start`}
            {state === "open" && "Your call is open. Join now."}
            {state === "ended" && "This call has ended"}
          </span>
        </div>
        {state !== "ended" && (
          <div className="row-wrap" style={{ gap: 8 }}>
            {canManage && (
              <Link className={`btn btn-sm ${state === "open" ? "btn-deep" : ""}`} href={`/calls/${booking.id}`}>
                {state === "open" ? "Join" : "Call page"}
              </Link>
            )}
            {canManage && (changeable || late) && !order.disputed && (
              <button className="btn btn-sm" onClick={() => setMoving((m) => !m)} aria-expanded={moving}>Reschedule</button>
            )}
            {((changeable || blocked) && canManage) || isAdmin ? (
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={cancel}>Cancel</button>
            ) : null}
          </div>
        )}
        {late && canManage && !order.disputed && (
          <span className="text-muted" style={{ flexBasis: "100%" }}>
            Less than {CANCEL_CUTOFF_HOURS} hours to go: the call can&apos;t be cancelled on the site, and moving it needs a short reason that&apos;s sent to {otherFirst}. Contact us if something comes up.
          </span>
        )}
      </div>
      {err && <div role="alert" className="alert alert-danger">{err}</div>}
      {moving && (
        <div className="stack">
          {late && <LateReasonField otherFirst={otherFirst} reason={mover.reason} setReason={mover.setReason} />}
          <Booker
            framed
            slotsUrl={`/api/orders/${order.id}/slots?exclude=${encodeURIComponent(booking.id)}`}
            mentor={isSeller ? { id: order.buyerId, name: order.buyer?.name || "Student", photoUrl: order.buyer?.photoUrl } : { id: order.sellerId, name: order.seller?.name || "Your mentor", photoUrl: order.seller?.photoUrl }}
            title="Reschedule the call"
            description={<>Now: {fmtDateTime(booking.startTime)}. Pick a new time; you&apos;ll both get an email with the updated calendar invite.</>}
            confirmLabel="Move here"
            onConfirm={move}
            onCancel={() => setMoving(false)}
            noHoursTitle={isSeller ? "You haven't set your call hours yet" : undefined}
            emptyHint={
              isSeller ? (
                <>Add them in <Link href="/dashboard/availability#call-hours" className="link">Availability</Link>, or enter a time you agreed below.</>
              ) : (
                "Message them to agree a time, and they can add it here."
              )
            }
          />
          {isSeller && (
            <div className="stack-sm">
              <span className="text-secondary small">Or enter another time you agreed with {studentFirst}:</span>
              <div className="row-wrap">
                <input type="datetime-local" className="input time-input" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="New call date and time" />
                <button className="btn btn-soft btn-sm" disabled={!custom || !mover.reasonOk} onClick={async () => { const e = await move(new Date(custom).toISOString()); if (e) setErr(e); }}>
                  Move to this time
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// What happened at a past call, in plain words (lib/callOutcomes.ts).
export function PastCallOutcome({ booking, order, viewer }: { booking: any; order: any; viewer: "student" | "mentor" | "admin" }) {
  if (!booking.outcome) {
    // Old calls (before outcomes existed) just count as done.
    if (callHeld(booking)) return null;
    return <span className="small text-secondary">Checking who joined. This usually takes under an hour after the call.</span>;
  }
  const tone = booking.outcome === "HELD" ? "badge-success" : NEEDS_ADMIN.includes(booking.outcome) ? "badge-warning" : "";
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      <span className={`badge ${tone}`} style={{ alignSelf: "flex-start", whiteSpace: "normal" }}>{outcomeLabel(booking.outcome, viewer)}</span>
      {booking.outcome === "STUDENT_NO_SHOW" && viewer === "mentor" && order.conversationId && (
        <span className="small text-secondary">
          Please <Link href={`/messages/${order.conversationId}`} className="link">message {(order.buyer?.name || "the student").split(" ")[0]}</Link> so there&apos;s a record.
        </span>
      )}
    </div>
  );
}

// Everything about calls on one order: booked calls (Join, Reschedule,
// Cancel), the slot picker for booking (students, only after payment and
// only when the package includes a call), past calls with attendance, and
// recordings for admins.
export function OrderCalls({
  order,
  isBuyer,
  isSeller,
  isAdmin = false,
  onChanged,
  compact = false,
}: {
  order: any;
  viewer?: unknown; // no longer used; kept so older callers still compile
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin?: boolean;
  onChanged?: () => void;
  compact?: boolean; // short summary for the Messages side panel
}) {
  const [booking, setBooking] = useState(false);
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const calls = callSummary(order);
  if (calls.included === 0) return null;

  if (compact) {
    const next = calls.upcoming[0];
    return (
      <div className="stack-sm small">
        {next && (
          <Link href={`/calls/${next.id}`} className="row link" style={{ gap: 6 }}>
            <Icon d={ICONS.video} size={16} /> Call {fmtDateTime(next.startTime)}
          </Link>
        )}
        {calls.canBook && !order.disputed && (
          <Link href={`/orders/${order.id}`} className="text-secondary">
            {isBuyer ? `Book your call (${calls.toBook} left) on the order page` : `${calls.toBook} call${calls.toBook === 1 ? "" : "s"} not booked yet`}
          </Link>
        )}
      </div>
    );
  }

  const mentorFirst = (order.seller?.name || "your mentor").split(" ")[0];
  const studentFirst = (order.buyer?.name || "the student").split(" ")[0];
  const bookable = calls.canBook && !order.disputed;
  const past = (order.callBookings || []).filter((b: any) => b.status !== "CANCELLED" && joinState(b) === "ended");

  async function book(startIso: string) {
    const e = await callApi(order.id, "POST", { startTime: startIso });
    if (!e) {
      setBooking(false);
      onChanged?.();
    }
    return e;
  }

  async function addManual() {
    if (!when) return;
    setSaving(true);
    setErr("");
    const e = await callApi(order.id, "POST", { startTime: new Date(when).toISOString() });
    setSaving(false);
    if (e) setErr(e);
    else {
      setWhen("");
      onChanged?.();
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="between">
        <b style={{ fontSize: 17 }}>Calls</b>
        <span className="text-muted">
          {calls.held} of {calls.included} done · {order.gig.callLength} min each
        </span>
      </div>

      {calls.mentorNoShows > 0 && calls.canBook && isBuyer && !order.disputed && (
        <div className="alert alert-blue">Your mentor missed a call, so it doesn&apos;t count. Book another one below for free.</div>
      )}
      {calls.awaitingAdmin > 0 && (
        <div className="alert alert-warning">
          {isAdmin ? "A past call needs a decision in Admin → Calls & recordings." : "Our records don't show a past call taking place. The MentorsMD team will be in touch to sort it out."}
        </div>
      )}

      {calls.upcoming.map((b) => (
        <CallRow key={b.id} booking={b} order={order} canManage={isBuyer || isSeller} isSeller={isSeller} isAdmin={isAdmin} onChanged={onChanged} />
      ))}

      {calls.waived && <div className="alert">The student chose to skip the call.</div>}
      {calls.forfeited && <div className="alert alert-warning">The call wasn&apos;t booked in time and was forfeited.</div>}

      {bookable && isBuyer && (
        booking ? (
          <Booker
            framed
            slotsUrl={`/api/orders/${order.id}/slots`}
            mentor={{ id: order.sellerId, name: order.seller?.name || "Your mentor", photoUrl: order.seller?.photoUrl }}
            title="Package call"
            durationMinutes={order.gig?.callLength || undefined}
            description={<>A one-to-one video call with {mentorFirst}, included in this package{calls.toBook > 1 ? ` (${calls.toBook} calls left to book)` : ""}. You&apos;ll both get an email with a calendar invite.</>}
            onConfirm={book}
            onCancel={() => setBooking(false)}
            emptyHint="Message them to agree a time, and they can add it here."
          />
        ) : (
          <div className="stack-sm">
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => setBooking(true)}>
              <Icon d={ICONS.calendar} size={18} /> Book a call{calls.toBook > 1 ? ` (${calls.toBook} left)` : ""}
            </button>
            <span className="text-muted">Pick from {mentorFirst}&apos;s open times. You&apos;ll both get an email with a calendar invite.</span>
          </div>
        )
      )}

      {bookable && isSeller && (
        <div className="stack-sm">
          {order.seller?.hasAvailability ? (
            <span className="text-secondary">Waiting for {studentFirst} to book from your open times. You can also add a time you agreed in messages:</span>
          ) : (
            <div className="alert alert-blue">
              Set your call hours so {studentFirst} can book from your open times.{" "}
              <Link href="/dashboard/availability#call-hours" className="link">Set call hours</Link>. Until then, agree a time in messages and add it here:
            </div>
          )}
          <div className="row-wrap">
            <input type="datetime-local" className="input time-input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Call date and time" />
            <button className="btn btn-soft" disabled={!when || saving} onClick={addManual}>
              {saving ? "Adding…" : "Add call time"}
            </button>
          </div>
          {err && <div role="alert" className="alert alert-danger">{err}</div>}
        </div>
      )}

      {past.length > 0 && (
        <div className="stack-sm">
          <b className="small">Past calls</b>
          {past.map((b: any) => (
            <div key={b.id} className="stack-sm" style={{ gap: 4 }}>
              <span className="small">{fmtDateTime(b.startTime)}</span>
              <PastCallOutcome booking={b} order={order} viewer={isBuyer ? "student" : isSeller ? "mentor" : "admin"} />
              <Attendance booking={b} order={order} />
              {isAdmin && <Recordings booking={b} />}
            </div>
          ))}
        </div>
      )}

      <p className="notice">{RECORDING_NOTICE}</p>
    </div>
  );
}
