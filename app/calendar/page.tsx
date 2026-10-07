"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { joinState } from "@/lib/calls";
import { BUSY_KINDS } from "@/lib/schedule";
import { labelFor } from "@/lib/options";
import { fmtDayLabel } from "@/lib/tz";

// "My calendar" for mentors and students: upcoming and recent calls, and
// for mentors the due dates of active orders and their busy dates.
function DateBadge({ d }: { d: Date }) {
  return (
    <span className="cal-date" aria-hidden="true">
      <span className="small text-secondary">{d.toLocaleDateString(undefined, { month: "short" })}</span>
      <b>{d.getDate()}</b>
      <span className="small text-muted">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
    </span>
  );
}

function dayDate(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function MyCalendarPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me/calendar")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setError(d.error || "Couldn't load your calendar");
        else setData(d);
      })
      .catch(() => setError("Couldn't load your calendar"));
  }, []);

  if (error) return <div className="page-narrow"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <div className="page-mid text-muted">Loading…</div>;

  const isMentor = data.role === "SELLER";
  const today = new Date().toISOString().slice(0, 10);

  // Upcoming calls and due dates, merged in date order.
  type Item = { key: string; when: Date; kind: "call" | "due"; node: React.ReactNode };
  const items: Item[] = [
    ...data.upcoming.map((c: any) => {
      const start = new Date(c.startTime);
      const open = joinState(c) === "open";
      return {
        key: `c${c.id}`,
        when: start,
        kind: "call" as const,
        node: (
          <div className="cal-item" key={`c${c.id}`}>
            <DateBadge d={start} />
            <div className="stack-sm grow" style={{ gap: 2, minWidth: 180 }}>
              <span className="row" style={{ gap: 6 }}><Icon d={ICONS.video} size={16} /><b>Call with {c.withName}</b></span>
              <span className="text-secondary small">
                {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} to{" "}
                {new Date(c.endTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · {c.title}
              </span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Link href={`/calls/${c.id}`} className={`btn btn-sm ${open ? "btn-deep" : ""}`}>{open ? "Join" : "Call page"}</Link>
              <Link href={`/orders/${c.orderId}`} className="btn btn-sm">Order</Link>
            </div>
          </div>
        ),
      };
    }),
    ...data.dueDates
      .filter((o: any) => o.dueDay >= today)
      .map((o: any) => ({
        key: `d${o.orderId}`,
        when: dayDate(o.dueDay),
        kind: "due" as const,
        node: (
          <div className="cal-item" key={`d${o.orderId}`}>
            <DateBadge d={dayDate(o.dueDay)} />
            <div className="stack-sm grow" style={{ gap: 2, minWidth: 180 }}>
              <span className="row" style={{ gap: 6 }}><Icon d={ICONS.doc} size={16} /><b>Due: {o.title}</b></span>
              <span className="text-secondary small">
                For {o.studentName}{o.revision ? " · revision requested" : ""}{o.onHold ? " · on hold (call not booked)" : ""}
              </span>
            </div>
            <Link href={`/orders/${o.orderId}`} className="btn btn-sm">Open order</Link>
          </div>
        ),
      })),
  ].sort((a, b) => a.when.getTime() - b.when.getTime());

  const overdue = data.dueDates.filter((o: any) => o.dueDay < today);

  return (
    <div className="page-mid stack-lg" style={{ gap: 28 }}>
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="stack-sm">
          <h1 className="page-title">My calendar</h1>
          <p className="lede">{isMentor ? "Your calls and due dates in one place." : "Your calls with mentors."}</p>
        </div>
        <div className="row-wrap">
          {isMentor && <Link href="/account#call-hours" className="btn btn-sm">Call hours &amp; busy dates</Link>}
          <Link href="/account#calendar" className="btn btn-sm">{data.feedConnected ? "Calendar sync" : "Add to my calendar app"}</Link>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="alert alert-danger stack-sm">
          <b>Past due</b>
          {overdue.map((o: any) => (
            <Link key={o.orderId} href={`/orders/${o.orderId}`} className="link small">
              {o.title} for {o.studentName}, due {fmtDayLabel(o.dueDay)}
            </Link>
          ))}
        </div>
      )}

      <section className="card" style={{ paddingTop: 10, paddingBottom: 10 }}>
        {items.length === 0 ? (
          <p className="text-muted" style={{ padding: "14px 0" }}>
            Nothing coming up.{" "}
            {isMentor ? "Booked calls and due dates show here." : <>Calls you book from an order show here. <Link href="/orders" className="link">My orders</Link></>}
          </p>
        ) : (
          items.map((i) => i.node)
        )}
      </section>

      {isMentor && data.busyDates.length > 0 && (
        <section className="stack-sm">
          <h2 style={{ fontSize: 24 }}>Your busy dates</h2>
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {data.busyDates.map((b: any) => (
              <div key={b.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <b className="grow">
                  {fmtDayLabel(b.startDay)}{b.endDay !== b.startDay ? ` to ${fmtDayLabel(b.endDay)}` : ""}
                </b>
                <span className="badge">{labelFor(BUSY_KINDS, b.kind)}</span>
                {b.note && <span className="text-muted small" style={{ flexBasis: "100%" }}>{b.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.past.length > 0 && (
        <details className="collapse">
          <summary>Past calls <span className="tab-count" style={{ marginRight: "auto", marginLeft: 8 }}>{data.past.length}</span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {data.past.map((c: any) => (
              <Link key={c.id} href={`/orders/${c.orderId}`} className="list-row">
                <span className="grow">
                  <b style={{ fontSize: 15 }}>Call with {c.withName}</b>
                  <span className="text-muted small" style={{ display: "block" }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
