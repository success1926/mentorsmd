"use client";

import Link from "next/link";
import { joinState } from "@/lib/calls";

// A mentor's upcoming calls as a short list (day, student, length, time,
// package, Join / Call page). Data: /api/me/calendar's `upcoming`. On the
// mentor home ("This week's calls") and Calendar & availability.

const DAY = 24 * 3600_000;

function DayChip({ d }: { d: Date }) {
  return (
    <span className="day-chip" aria-hidden="true">
      <span>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
      <b>{d.getDate()}</b>
    </span>
  );
}

// The next 14 days of calls (from My calendar's data).
export function UpcomingCalls({ calls, days = 14, empty }: { calls: any[] | null; days?: number; empty?: string }) {
  if (calls === null) return <span className="text-muted">Loading…</span>;
  const soon = calls.filter((c) => new Date(c.startTime).getTime() < Date.now() + days * DAY);
  if (soon.length === 0) return <span className="text-muted">{empty || "No calls booked yet."}</span>;
  return (
    <div>
      {soon.map((c) => {
        const start = new Date(c.startTime);
        const minutes = Math.round((new Date(c.endTime).getTime() - start.getTime()) / 60000);
        const open = joinState(c) === "open";
        return (
          <div key={c.id} className="mentor-row">
            <DayChip d={start} />
            <div className="grow stack-sm" style={{ gap: 0, minWidth: 0 }}>
              <b style={{ fontSize: 15 }}>{c.withName || "Student"} · {minutes} min</b>
              <span className="text-muted small">
                {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {c.title}
              </span>
            </div>
            <Link href={`/calls/${c.id}`} className={`btn btn-sm ${open ? "btn-deep" : "btn-soft"}`}>{open ? "Join" : "Call page"}</Link>
          </div>
        );
      })}
    </div>
  );
}

