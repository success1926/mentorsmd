"use client";

import { useEffect, useMemo, useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import { RECORDING_NOTICE } from "@/lib/calls";
import { browserTimeZone, dayInZone, isValidTimeZone } from "@/lib/tz";

// Lets the student (or mentor) pick an open call time from the mentor's
// availability. Times are shown in the viewer's own time zone.
export function SlotPicker({
  orderId,
  excludeBookingId,
  mentorFirstName,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  orderId: string;
  excludeBookingId?: string;
  mentorFirstName: string;
  confirmLabel: string;
  onConfirm: (startIso: string) => Promise<string | null>; // returns an error message, or null
  onCancel?: () => void;
}) {
  const [data, setData] = useState<{ slots: string[]; lengthMinutes: number; hasAvailability: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [day, setDay] = useState("");
  const [picked, setPicked] = useState("");
  const [saving, setSaving] = useState(false);
  const tz = useMemo(() => browserTimeZone() || "UTC", []);

  function load() {
    setData(null);
    setDay("");
    setLoadError("");
    fetch(`/api/orders/${orderId}/slots${excludeBookingId ? `?exclude=${encodeURIComponent(excludeBookingId)}` : ""}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Couldn't load times");
        setData({ slots: d.slots || [], lengthMinutes: d.lengthMinutes || 30, hasAvailability: !!d.hasAvailability });
      })
      .catch((e) => setLoadError(e.message || "Couldn't load times"));
  }
  useEffect(load, [orderId, excludeBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of data?.slots || []) {
      const d = dayInZone(new Date(s), isValidTimeZone(tz) ? tz : "UTC");
      m.set(d, [...(m.get(d) || []), s]);
    }
    return m;
  }, [data, tz]);
  const days = Array.from(byDay.keys()).sort();

  useEffect(() => {
    if (!day && days.length) setDay(days[0]);
  }, [days, day]);

  if (loadError) return <div className="alert alert-danger">{loadError} <button className="link-btn link" onClick={load}>Try again</button></div>;
  if (!data) return <p className="text-muted">Loading open times…</p>;

  if (!data.slots.length) {
    return (
      <div className="alert alert-blue stack-sm">
        <span>
          {data.hasAvailability
            ? `${mentorFirstName} has no open times in the next few weeks.`
            : `${mentorFirstName} hasn't set their call hours yet.`}{" "}
          Message them to agree a time, and they can add it here.
        </span>
        {onCancel && <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={onCancel}>Close</button>}
      </div>
    );
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  async function confirm() {
    if (!picked) return;
    setSaving(true);
    setError("");
    const err = await onConfirm(picked);
    setSaving(false);
    if (err) {
      setPicked("");
      setError(err);
      load();
    }
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="picker-wrap">
        <DatePicker
          value={day}
          onChange={(d) => { setDay(d); setPicked(""); }}
          min={days[0]}
          max={days[days.length - 1]}
          isDisabled={(d) => !byDay.has(d)}
          initialMonth={days[0]}
          label="Days with open times"
        />
        <div className="stack-sm grow">
          <b>{day ? new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) : "Pick a day"}</b>
          <span className="text-muted">{data.lengthMinutes}-minute call · times in your time zone ({tz.replace(/_/g, " ")})</span>
          <div className="slot-grid" role="radiogroup" aria-label="Open times">
            {(byDay.get(day) || []).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={picked === s} aria-pressed={picked === s} className="slot-btn" onClick={() => setPicked(s)}>
                {fmtTime(s)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <p className="notice">{RECORDING_NOTICE}</p>
      <div className="row-wrap">
        <button className="btn btn-primary" disabled={!picked || saving} onClick={confirm}>
          {saving ? "Saving…" : picked ? `${confirmLabel}: ${new Date(picked).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : confirmLabel}
        </button>
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
