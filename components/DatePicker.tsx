"use client";

import { useMemo, useState } from "react";
import { addDays, fmtDayLabel, weekdayOfDay } from "@/lib/tz";

// A month calendar where some days can't be picked (greyed out). Used for
// the checkout due date (mentor busy dates) and the call slot picker
// (days with open times). Days are "YYYY-MM-DD" strings.
export function DatePicker({
  value,
  onChange,
  min,
  max,
  isDisabled,
  initialMonth,
  label = "Choose a date",
}: {
  value: string;
  onChange: (day: string) => void;
  min?: string;
  max?: string;
  isDisabled?: (day: string) => boolean;
  initialMonth?: string; // any day in the month to open on
  label?: string;
}) {
  const start = (initialMonth || value || min || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [month, setMonth] = useState(start); // "YYYY-MM"

  const days = useMemo(() => {
    const first = `${month}-01`;
    const lead = weekdayOfDay(first);
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const canPrev = !min || `${month}-01` > min;
  const canNext = !max || addDays(`${month}-01`, 31).slice(0, 7) <= max.slice(0, 7);

  return (
    <div className="cal" role="group" aria-label={label}>
      <div className="between cal-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month">‹</button>
        <b>{fmtDayLabel(`${month}-01`, { month: "long", year: "numeric" })}</b>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => shift(1)} disabled={!canNext} aria-label="Next month">›</button>
      </div>
      <div className="cal-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="cal-dow" aria-hidden="true">{d}</span>
        ))}
        {days.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const off = (min && d < min) || (max && d > max) || (isDisabled ? isDisabled(d) : false);
          return (
            <button
              key={d}
              type="button"
              className="cal-day"
              aria-pressed={value === d}
              disabled={!!off}
              aria-label={fmtDayLabel(d, { weekday: "long", month: "long", day: "numeric" }) + (off ? " (not available)" : "")}
              onClick={() => onChange(d)}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
