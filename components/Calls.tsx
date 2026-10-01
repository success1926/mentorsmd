"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import {
  BookingLike,
  CANCEL_CUTOFF_HOURS,
  JOIN_OPENS_MINUTES_BEFORE,
  calBookingUrl,
  calManageUrls,
  callSummary,
  canChangeOnline,
  fmtDateTime,
  joinState,
} from "@/lib/calls";

// Re-render every 30s so the Join button switches on at the right time.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

async function joinCall(bookingId: string) {
  // Open the tab first (synchronously) so pop-up blockers allow it.
  const tab = window.open("", "_blank");
  const res = await fetch("/api/video/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.url) {
    if (tab) tab.location.href = data.url;
    else window.location.href = data.url;
  } else {
    tab?.close();
    alert(data.error || "Couldn't open the call");
  }
}

export function CallRow({
  booking,
  orderId,
  calBase,
  onChanged,
}: {
  booking: BookingLike;
  orderId: string;
  calBase: string | null;
  onChanged?: () => void;
}) {
  const now = useNow();
  const state = joinState(booking, now);
  const changeable = canChangeOnline(booking, now);
  const manage = booking.source === "CAL" ? calManageUrls(calBase, booking.calUid) : null;
  const [busy, setBusy] = useState(false);

  async function cancelManual() {
    if (!confirm("Cancel this call? The other person will get an email.")) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/schedule-call`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) alert(data.error || "Couldn't cancel the call");
    else onChanged?.();
  }

  return (
    <div className="call-row">
      <Icon d={ICONS.video} />
      <div className="stack-sm grow" style={{ gap: 2 }}>
        <b>{fmtDateTime(booking.startTime)}</b>
        <span className="text-muted">
          {state === "early" && `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before the start`}
          {state === "open" && "Your call is open. Join now."}
          {state === "ended" && "This call has ended"}
        </span>
      </div>
      {state !== "ended" && (
        <div className="row-wrap" style={{ gap: 8 }}>
          <button className="btn btn-deep btn-sm" disabled={state !== "open"} onClick={() => joinCall(booking.id)}>
            Join
          </button>
          {changeable && manage && (
            <>
              <a className="btn btn-sm" href={manage.reschedule} target="_blank" rel="noopener noreferrer">Reschedule</a>
              <a className="btn btn-sm btn-danger" href={manage.cancel} target="_blank" rel="noopener noreferrer">Cancel</a>
            </>
          )}
          {changeable && booking.source === "MANUAL" && (
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={cancelManual}>Cancel</button>
          )}
        </div>
      )}
      {state !== "ended" && !changeable && (
        <span className="text-muted" style={{ flexBasis: "100%" }}>
          Within {CANCEL_CUTOFF_HOURS} hours of the call, changes are made by message. Contact us if something comes up.
        </span>
      )}
    </div>
  );
}

// Everything about calls on one order: booked calls, the "Book a call"
// button (students, only after payment and only when the package includes
// a call), and the fallback when the mentor hasn't connected Cal.com.
export function OrderCalls({
  order,
  viewer,
  isBuyer,
  isSeller,
  onChanged,
  compact = false,
}: {
  order: any;
  viewer: { name: string; email: string };
  isBuyer: boolean;
  isSeller: boolean;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const calls = callSummary(order);
  if (calls.included === 0) return null;

  const calBase: string | null = order.gig.calEventUrl || order.seller?.calLink || null;
  const first = (order.seller?.name || "your mentor").split(" ")[0];
  const bookable = calls.canBook && !order.disputed;
  const past = (order.callBookings || []).filter((b: any) => b.status !== "CANCELLED" && joinState(b) === "ended");

  async function addManual() {
    if (!when) return;
    setSaving(true);
    const res = await fetch(`/api/orders/${order.id}/schedule-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime: new Date(when).toISOString() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) alert(data.error || "Couldn't add the call");
    else {
      setWhen("");
      onChanged?.();
    }
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {!compact && (
        <div className="between">
          <b style={{ fontSize: 17 }}>Calls</b>
          <span className="text-muted">
            {calls.held} of {calls.included} done · {order.gig.callLength} min each
          </span>
        </div>
      )}

      {calls.upcoming.map((b) => (
        <CallRow key={b.id} booking={b} orderId={order.id} calBase={calBase} onChanged={onChanged} />
      ))}

      {!compact && past.length > 0 && (
        <span className="text-muted">
          Past calls: {past.map((b: any) => fmtDateTime(b.startTime)).join(", ")}
        </span>
      )}

      {calls.waived && <div className="alert">The student chose to skip the call.</div>}
      {calls.forfeited && <div className="alert alert-warning">The call wasn&apos;t booked in time and was forfeited.</div>}

      {bookable && isBuyer && (
        calBase ? (
          <div className="stack-sm">
            <a
              className="btn btn-primary"
              href={calBookingUrl(calBase, { orderId: order.id, name: viewer.name, email: viewer.email })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon d={ICONS.calendar} size={18} /> Book a call{calls.toBook > 1 ? ` (${calls.toBook} left)` : ""}
            </a>
            <span className="text-muted">Opens {first}&apos;s Cal.com calendar. Once you book, it shows up here (refresh the page).</span>
          </div>
        ) : (
          <div className="alert alert-blue">
            {first} hasn&apos;t connected a booking calendar yet. Message them to agree a time, and they&apos;ll add it here.
          </div>
        )
      )}

      {bookable && isSeller && (
        <div className="stack-sm">
          {calBase ? (
            <span className="text-secondary">Waiting for the student to book on your Cal.com. You can also add a time you agreed in messages:</span>
          ) : (
            <div className="alert alert-blue">
              Connect Cal.com so students can book calls themselves.{" "}
              <Link href="/account#calendar" className="link">Connect now</Link>. Until then, agree a time in messages and add it here:
            </div>
          )}
          <div className="row-wrap">
            <input
              type="datetime-local"
              className="input"
              style={{ marginBottom: 0, width: "auto" }}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Call date and time"
            />
            <button className="btn btn-soft" disabled={!when || saving} onClick={addManual}>
              {saving ? "Adding…" : "Add call time"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
