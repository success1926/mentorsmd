"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Attendance, Recordings } from "@/components/Calls";
import { NEEDS_ADMIN, outcomeLabel } from "@/lib/callOutcomes";

// The admin's choices for a past call (see /api/admin/calls/[id]/outcome).
const OVERRIDES = [
  { outcome: "HELD", label: "Count as held", confirm: "Count this call as held? It's used up, and nobody is emailed." },
  { outcome: "FREE_REBOOK", label: "Give a free rebook", confirm: "Give a free rebook? The call no longer counts, so the student can book another. Nobody is emailed, so tell them yourself." },
  { outcome: "STUDENT_NO_SHOW", label: "Mark student no-show", confirm: "Mark as a student no-show? The call counts as used, and both get the no-show email." },
  { outcome: "MENTOR_NO_SHOW", label: "Mark mentor no-show", confirm: "Mark as a mentor no-show? The call's time goes back to the student's hours (a free rebook), and both get the no-show email." },
];

function OutcomeBadge({ c }: { c: any }) {
  if (!c.outcome) return <span className="badge">Not decided yet</span>;
  const tone = c.outcome === "HELD" ? "badge-success" : NEEDS_ADMIN.includes(c.outcome) ? "badge-warning" : c.outcome === "MENTOR_NO_SHOW" ? "badge-danger" : "";
  return (
    <span className={`badge ${tone}`}>
      {outcomeLabel(c.outcome)}
      {c.outcomeById ? " (set by an admin)" : " (automatic)"}
    </span>
  );
}

// Admin -> Calls & recordings: upcoming and past calls, attendance,
// recordings, each past call's outcome (with buttons to change it), and
// the "Connect Daily webhook" button. Free intro calls are listed too
// (labelled INTRO, no package); their outcome is automatic and can't be
// changed here.
export function CallsAdmin() {
  const [data, setData] = useState<{ calls: any[]; setup: any } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hookMsg, setHookMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [outcomeMsg, setOutcomeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () =>
    fetch("/api/admin/calls").then((r) => r.json()).then((d) => setData({ calls: d.calls || [], setup: d.setup || {} })).catch(() => setData({ calls: [], setup: {} }));
  useEffect(() => {
    load();
  }, []);

  async function setOutcome(c: any, o: (typeof OVERRIDES)[number]) {
    if (!confirm(o.confirm)) return;
    setBusy(c.id);
    setOutcomeMsg(null);
    const res = await fetch(`/api/admin/calls/${c.id}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: o.outcome }) });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setOutcomeMsg(res.ok ? { ok: true, text: `Saved: ${outcomeLabel(o.outcome)}.` } : { ok: false, text: d.error || "Couldn't save that" });
    load();
  }

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
  const undecided = past.filter((c) => c.outcome && NEEDS_ADMIN.includes(c.outcome)).length;

  // Opened from a link (?open=<call id>, e.g. the admin search box): open
  // its list, scroll to it and outline it.
  const openId = useSearchParams()?.get("open") || null;
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !openId || scrolledTo.current === openId) return;
    scrolledTo.current = openId;
    window.setTimeout(() => document.getElementById(`call-${openId}`)?.scrollIntoView({ block: "center" }), 50);
  }, [data, openId]);
  const mark = (id: string) => (id === openId ? { outline: "2px solid var(--primary)", outlineOffset: 4, borderRadius: 8 } : {});

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
      <span className="text-secondary">
        About 30 minutes after each call ends, the site decides what happened from who joined: held (both there together for 10+ minutes),
        student no-show (the mentor joined, the student hadn&apos;t by 15 minutes in: the call is used), mentor no-show (the student joined, the
        mentor hadn&apos;t by 15 minutes in: the student gets a free rebook) or nobody joined (needs your decision). You can change any of them below.
      </span>
      {undecided > 0 && <div className="alert alert-warning">{undecided} past call{undecided === 1 ? " needs" : "s need"} a decision: open &quot;Past 60 days&quot; below.</div>}
      {outcomeMsg && <div role="status" className={`alert ${outcomeMsg.ok ? "alert-success" : "alert-danger"}`}>{outcomeMsg.text}</div>}
      <details className="collapse" open={upcoming.some((c) => c.id === openId) || undefined}>
        <summary><span className="row" style={{ gap: 8 }}>Upcoming <span className="tab-count">{upcoming.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {upcoming.length === 0 && <span className="text-muted">No upcoming calls.</span>}
          {upcoming.map((c) => (
            <div key={c.id} id={`call-${c.id}`} className="list-row" style={{ flexWrap: "wrap", ...mark(c.id) }}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                <span className="text-muted">{c.label} · {c.studentName} (student) with {c.mentorName} (mentor)</span>
              </div>
              {c.intro ? <span className="badge badge-blue">INTRO</span> : <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open package</Link>}
            </div>
          ))}
        </div>
      </details>
      <details className="collapse" open={past.some((c) => c.id === openId) || undefined}>
        <summary><span className="row" style={{ gap: 8 }}>Past 60 days <span className="tab-count">{past.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {past.length === 0 && <span className="text-muted">No calls yet.</span>}
          {past.map((c) => (
            <div key={c.id} id={`call-${c.id}`} className="list-row" style={{ display: "block", ...mark(c.id) }}>
              <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                  <span className="text-muted">{c.label} · {c.studentName} (student) with {c.mentorName} (mentor)</span>
                </span>
                <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {c.intro && <span className="badge badge-blue">INTRO</span>}
                  <OutcomeBadge c={c} />
                  {c.disputeOpen && <span className="badge badge-danger">Disputed</span>}
                  {!c.intro && <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open package</Link>}
                </span>
              </div>
              <div className="stack-sm" style={{ paddingTop: 8 }}>
                <Attendance booking={c} order={c.order} />
                <Recordings booking={c} />
                <div className="row-wrap" style={{ gap: 6 }} hidden={c.intro}>
                  {OVERRIDES.filter((o) => o.outcome !== c.outcome).map((o) => (
                    <button key={o.outcome} className="btn btn-sm" disabled={busy === c.id} onClick={() => setOutcome(c, o)}>{o.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
