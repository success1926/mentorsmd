"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Attendance, Recordings } from "@/components/Calls";

// Admin -> Calls & recordings: upcoming and past calls, attendance,
// recordings, and the "Connect Daily webhook" button.
export function CallsAdmin() {
  const [data, setData] = useState<{ calls: any[]; setup: any } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hookMsg, setHookMsg] = useState("");
  useEffect(() => {
    fetch("/api/admin/calls").then((r) => r.json()).then((d) => setData({ calls: d.calls || [], setup: d.setup || {} })).catch(() => setData({ calls: [], setup: {} }));
  }, []);

  async function connectWebhook() {
    setHookMsg("");
    const res = await fetch("/api/admin/daily-webhook", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setHookMsg(d.error || "Couldn't connect the webhook");
    setSecret(d.secret);
  }

  const now = Date.now();
  const calls = data?.calls || [];
  const past = calls.filter((c) => new Date(c.endTime).getTime() < now && c.status !== "CANCELLED");
  const upcoming = calls.filter((c) => new Date(c.endTime).getTime() >= now && c.status === "BOOKED").reverse();
  const setup = data?.setup || {};

  return (
    <section className="stack-sm" id="calls">
      <h2 style={{ fontSize: 30 }}>Calls &amp; recordings</h2>
      {data && (
        <div className="row-wrap small">
          <span className={`badge ${setup.video ? "badge-success" : "badge-danger"}`}>{setup.video ? "Video on" : "Video off: set DAILY_API_KEY"}</span>
          <span className={`badge ${setup.recording ? "badge-success" : ""}`}>{setup.recording ? "Recording on" : "Recording off"}</span>
          <span className={`badge ${setup.webhookSecret ? "badge-success" : "badge-warning"}`}>{setup.webhookSecret ? "Attendance webhook secured" : "Attendance webhook not secured"}</span>
          {setup.video && !setup.webhookSecret && !secret && <button className="btn btn-sm" onClick={connectWebhook}>Connect Daily webhook</button>}
        </div>
      )}
      {hookMsg && <div className="alert alert-danger">{hookMsg}</div>}
      {secret && (
        <div className="alert alert-success stack-sm">
          <b>Webhook connected.</b>
          <span>Copy this secret into Vercel → Settings → Environment Variables as <code>DAILY_WEBHOOK_SECRET</code>, then redeploy:</span>
          <input className="input" readOnly value={secret} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, marginBottom: 0 }} />
        </div>
      )}
      <span className="text-secondary">Recordings are only for checking problems (disputes, no-shows). They&apos;re deleted automatically 60 days after the order closes.</span>
      <details className="collapse">
        <summary><span className="row" style={{ gap: 8 }}>Upcoming <span className="tab-count">{upcoming.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {upcoming.length === 0 && <span className="text-muted">No upcoming calls.</span>}
          {upcoming.map((c) => (
            <div key={c.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                <span className="text-muted">{c.order.gig.title} · {c.order.buyer.name} (student) with {c.order.seller.name} (mentor)</span>
              </div>
              <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open order</Link>
            </div>
          ))}
        </div>
      </details>
      <details className="collapse">
        <summary><span className="row" style={{ gap: 8 }}>Past 60 days <span className="tab-count">{past.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {past.length === 0 && <span className="text-muted">No calls yet.</span>}
          {past.map((c) => (
            <div key={c.id} className="list-row" style={{ display: "block" }}>
              <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                  <span className="text-muted">{c.order.gig.title} · {c.order.buyer.name} (student) with {c.order.seller.name} (mentor)</span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {c.order.disputed && <span className="badge badge-danger">Disputed</span>}
                  <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open order</Link>
                </span>
              </div>
              <div className="stack-sm" style={{ paddingTop: 8 }}>
                <Attendance booking={c} order={c.order} />
                <Recordings booking={c} />
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
