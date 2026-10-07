"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { JOIN_CLOSES_MINUTES_AFTER, JOIN_OPENS_MINUTES_BEFORE, RECORDING_NOTICE, joinState } from "@/lib/calls";

// The pre-join screen: what the call is, who it's with, the recording
// notice, then "Join call", which opens the private video room with the
// person's own meeting token.
export default function CallPage() {
  const params = useParams();
  const id = params.id as string;
  const [call, setCall] = useState<any>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch(`/api/calls/${id}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setError(d.error || "Call not found");
        else setCall(d.call);
      })
      .catch(() => setError("Couldn't load this call"));
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [id]);

  if (error) return <div className="page-narrow"><div className="alert alert-danger">{error}</div></div>;
  if (!call) return <div className="page-narrow text-muted">Loading…</div>;

  const state = joinState(call, now);
  const start = new Date(call.startTime);
  const end = new Date(call.endTime);
  const cancelled = call.status === "CANCELLED";
  const inactive = !["IN_ESCROW", "COMPLETED"].includes(call.orderStatus);

  async function join() {
    setJoining(true);
    setJoinError("");
    const res = await fetch(`/api/calls/${id}/join`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.url) {
      window.location.href = d.url;
      return;
    }
    setJoining(false);
    setJoinError(d.error || "Couldn't open the call");
  }

  return (
    <div className="page-narrow">
      <Link href={`/orders/${call.orderId}`} className="link small" style={{ display: "inline-block", marginBottom: 20 }}>← Back to the order</Link>
      <div className="card-narrow stack" style={{ maxWidth: 560 }}>
        <span className="eyebrow">Video call</span>
        <h1 className="page-title" style={{ fontSize: 34 }}>Call with {call.otherName}</h1>
        <span className="text-secondary">{call.title}</span>
        <div className="call-row">
          <Icon d={ICONS.calendar} />
          <div className="stack-sm" style={{ gap: 2 }}>
            <b>{start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</b>
            <span className="text-secondary">
              {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} to{" "}
              {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
            </span>
          </div>
        </div>

        {cancelled ? (
          <div className="alert alert-warning">This call was cancelled. A new time can be booked from the order page.</div>
        ) : inactive ? (
          <div className="alert">This order is no longer active.</div>
        ) : !call.canJoin ? (
          <div className="alert">Only the student and mentor on this order can join.</div>
        ) : state === "ended" ? (
          <div className="alert">This call has ended. The room closes {JOIN_CLOSES_MINUTES_AFTER} minutes after the scheduled end.</div>
        ) : (
          <>
            <div className="alert alert-blue stack-sm">
              <b>Before you join</b>
              <span>Use a quiet spot with good internet. Your browser will ask to use your camera and microphone; choose Allow.</span>
              <span>{RECORDING_NOTICE}</span>
            </div>
            {joinError && <div role="alert" className="alert alert-danger">{joinError}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={state !== "open" || joining} onClick={join}>
              <Icon d={ICONS.video} size={18} /> {joining ? "Opening…" : state === "open" ? "Join call" : `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before the start`}
            </button>
            <span className="text-muted" style={{ textAlign: "center" }}>By joining, you accept the recording notice above.</span>
          </>
        )}
      </div>
    </div>
  );
}
