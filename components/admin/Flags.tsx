"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffBadge } from "@/components/ui";
import { money } from "@/lib/options";

// Admin -> Flags (#87): reports, disputes and automatic flags in one
// queue, most severe first. Evidence is shown with the matching words
// highlighted. Actions: Dismiss / Warn / Pause / Remove.

const fmt = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const SEVERITY: Record<number, { label: string; cls: string }> = {
  3: { label: "High", cls: "badge-danger" },
  2: { label: "Medium", cls: "badge-warning" },
  1: { label: "Low", cls: "" },
};

const KIND_LABEL: Record<string, string> = {
  REPORT: "Report",
  DISPUTE: "Dispute",
  LANGUAGE: "Language",
  OFF_SITE: "Off-site",
  GHOSTWRITING: "Ghostwriting",
  CREDENTIALS: "Login details",
  LINK: "Unsafe link",
  AI: "AI check",
  PERFORMANCE: "Performance",
  BLOCKED_MESSAGE: "Blocked message",
  MINOR: "Under 18",
};
export const kindLabel = (k: string) => KIND_LABEL[k] || k;

const ACTION_LABEL: Record<string, string> = {
  DISMISS: "Dismissed",
  WARN: "Warned",
  PAUSE: "Paused",
  REMOVE: "Removed",
  REFUND: "Refunded",
  RELEASE: "Released to mentor",
  AUTO_PAUSE: "Paused automatically",
};

const roleWord = (r?: string) => (r === "SELLER" ? "mentor" : r === "BUYER" ? "student" : r === "ADMIN" ? "admin" : "");

function sourceLine(f: any) {
  if (f.source === "USER") return f.reporter ? `Reported by ${f.reporter.name} (${roleWord(f.reporter.role)})` : "Reported";
  if (f.source === "AI") return "AI check";
  if (f.source === "CRON") return "Daily check";
  if (f.source === "SYSTEM") return "System";
  return "Automatic";
}

// Evidence with the matched words/phrases highlighted.
export function Highlighted({ text, matches }: { text: string; matches: string[] }) {
  const terms = (matches || []).filter((m) => m && m.length > 1);
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export function FlagsAdmin({ onChanged }: { onChanged?: () => void }) {
  const [view, setView] = useState<"open" | "closed">("open");
  const [data, setData] = useState<{ flags: any[]; counts: { open: number; high: number } } | null>(null);
  const [kind, setKind] = useState("ALL");

  const load = useCallback(() => {
    fetch(`/api/admin/flags?view=${view}`)
      .then((r) => r.json())
      .then((d) => setData({ flags: d.flags || [], counts: d.counts || { open: 0, high: 0 } }))
      .catch(() => setData({ flags: [], counts: { open: 0, high: 0 } }));
  }, [view]);
  useEffect(load, [load]);

  const flags = (data?.flags || []).filter((f) => kind === "ALL" || f.kind === kind);
  const kinds = Array.from(new Set((data?.flags || []).map((f) => f.kind)));

  return (
    <section className="stack-sm" id="flags">
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 30 }}>Flags</h2>
        {data && data.counts.high > 0 && <span className="badge badge-danger">{data.counts.high} high severity open</span>}
      </div>
      <p className="text-secondary">Reports from students and mentors, disputes, and automatic flags (word filter, off-site contact, ghostwriting, links, AI check, daily performance checks). Most serious first. Three upheld flags (Warn, Pause or Remove) about the same person within 90 days pauses their account automatically.</p>
      <div className="row-wrap">
        <div className="tabs" role="tablist">
          <button role="tab" className="tab" aria-selected={view === "open"} onClick={() => setView("open")}>
            Open {data && <span className="tab-count">{data.counts.open}</span>}
          </button>
          <button role="tab" className="tab" aria-selected={view === "closed"} onClick={() => setView("closed")}>Handled</button>
        </div>
        {kinds.length > 1 && (
          <select className="input" style={{ width: "auto", marginBottom: 0 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
            <option value="ALL">All types</option>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
          </select>
        )}
      </div>
      {data === null && <p className="text-muted">Loading…</p>}
      {data && flags.length === 0 && <div className="card text-muted">{view === "open" ? "Nothing to review. Nice." : "No handled flags yet."}</div>}
      {flags.map((f) => (
        <FlagCard key={f.id} flag={f} onDone={() => { load(); onChanged?.(); }} />
      ))}
    </section>
  );
}

function FlagCard({ flag: f, onDone }: { flag: any; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [thread, setThread] = useState<any[] | null>(null);
  const [showThread, setShowThread] = useState(false);
  const sev = SEVERITY[f.severity] || SEVERITY[1];
  const subject = f.subject;
  const open = f.status === "OPEN";

  async function act(action: string) {
    const who = subject?.name || "this person";
    if (action === "PAUSE" && !confirm(`Pause ${who}'s account pending review? ${subject?.role === "SELLER" ? "Their profile is hidden from search." : "They can't send messages."} They get an email.`)) return;
    if (action === "WARN" && !confirm(`Email ${who} a warning about "${f.reason}"? Your note is included.`)) return;
    let n = note;
    if (action === "REMOVE") {
      const r = prompt(`Remove ${who}? They'll be hidden and can't log in. Reason (kept on record):`, note);
      if (r === null) return;
      if (!r.trim()) return alert("A reason is required.");
      n = r;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/admin/flags/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: n || null }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(d.error || "That didn't work.");
    onDone();
  }

  function toggleThread() {
    setShowThread((s) => !s);
    if (thread === null) {
      fetch(`/api/admin/flags/${f.id}`).then((r) => r.json()).then((d) => setThread(d.messages || [])).catch(() => setThread([]));
    }
  }

  return (
    <div className={`card stack-sm flag-card sev-${f.severity}`} style={{ padding: 18 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        <span className="row-wrap" style={{ gap: 6 }}>
          <span className={`badge ${sev.cls}`}>{sev.label}</span>
          <span className="badge badge-brand">{kindLabel(f.kind)}</span>
          <span className="text-muted small">{sourceLine(f)} · {fmt(f.createdAt)}</span>
        </span>
        {!open && (
          <span className="badge badge-success">
            {ACTION_LABEL[f.action] || f.status}{f.resolvedBy ? ` by ${f.resolvedBy.name}` : ""}{f.resolvedAt ? ` · ${fmt(f.resolvedAt)}` : ""}
          </span>
        )}
      </div>
      <b style={{ fontSize: 16 }}>{f.reason}</b>
      {subject && (
        <span className="small row-wrap" style={{ gap: 6 }}>
          About <b>{subject.name}</b> ({roleWord(subject.role)}) · {subject.email}
          {subject.safetyHoldAt && <span className="badge badge-warning">On hold</span>}
          {subject.profileStatus === "REMOVED" && <span className="badge badge-danger">Removed</span>}
          {subject.role === "SELLER" && <Link href={`/mentors/${subject.id}`} className="link">Profile</Link>}
        </span>
      )}
      {f.details && <p className="text-secondary small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{f.details}</p>}
      {f.evidence && (
        <div className="evidence">
          <Highlighted text={f.evidence} matches={f.matches} />
        </div>
      )}
      {f.order && (
        <span className="small">
          Order: <b>{f.order.gig.title}</b> · {money(f.order.amount)} · {f.order.status.toLowerCase().replace(/_/g, " ")}{f.order.disputed ? " · disputed" : ""} ·{" "}
          <Link href={`/orders/${f.order.id}`} className="link">Open order</Link>
          {f.kind === "DISPUTE" && open && <> · refund or release it under <a href="#disputes" className="link">Disputes</a></>}
        </span>
      )}
      {f.conversationId && (
        <button type="button" className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={toggleThread}>
          {showThread ? "Hide conversation" : "Show the conversation"}
        </button>
      )}
      {showThread && (
        <div className="msg-thread" style={{ maxHeight: 360, overflowY: "auto" }}>
          {thread === null && <span className="text-muted">Loading…</span>}
          {thread?.length === 0 && <span className="text-muted">No messages.</span>}
          {thread?.map((m) => (
            <div key={m.id} className={`msg-bubble ${m.senderId === subject?.id ? "msg-theirs" : "msg-mine"}`} style={m.id === f.messageId ? { outline: "3px solid #E3A008" } : undefined}>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
                {m.sender?.name} ({roleWord(m.sender?.role)}) {m.sender?.role === "ADMIN" && <StaffBadge />} · {fmt(m.createdAt)}
              </div>
              <Highlighted text={m.body} matches={m.id === f.messageId ? f.matches : []} />
              {m.attachmentName && (
                <div className="small" style={{ marginTop: 4 }}>
                  📎 <a href={`${m.attachmentUrl}?download=1`} target="_blank" rel="noopener noreferrer" className="link">{m.attachmentName}</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {f.resolutionNote && !open && <span className="text-muted small">Note: {f.resolutionNote}</span>}
      {msg && <div role="alert" className="alert alert-danger small">{msg}</div>}
      {open ? (
        <div className="stack-sm">
          <input className="input" style={{ marginBottom: 0 }} placeholder="Note (optional; included in a warning email, kept on record)" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          <div className="row-wrap">
            <button className="btn btn-sm" disabled={busy} onClick={() => act("DISMISS")}>Dismiss</button>
            {subject && subject.role !== "ADMIN" && (
              <>
                <button className="btn btn-sm btn-soft" disabled={busy} onClick={() => act("WARN")}>Warn</button>
                <button className="btn btn-sm" disabled={busy || !!subject.safetyHoldAt} onClick={() => act("PAUSE")}>{subject.safetyHoldAt ? "Already paused" : "Pause"}</button>
                <button className="btn btn-sm btn-danger" disabled={busy || subject.profileStatus === "REMOVED"} onClick={() => act("REMOVE")}>Remove</button>
              </>
            )}
          </div>
        </div>
      ) : (
        f.kind !== "DISPUTE" && (
          <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => act("REOPEN")}>Reopen</button>
        )
      )}
    </div>
  );
}

// Admin -> Action log (#98).
export function ActionLog() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback((before?: string) => {
    fetch(`/api/admin/actions${before ? `?before=${encodeURIComponent(before)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setRows((prev) => (before ? [...(prev || []), ...(d.actions || [])] : d.actions || []));
        setHasMore(!!d.hasMore);
      })
      .catch(() => setRows((prev) => prev || []));
  }, []);
  useEffect(() => load(), [load]);

  return (
    <section className="stack-sm" id="action-log">
      <h2 style={{ fontSize: 30 }}>Action log</h2>
      <p className="text-secondary">Every admin decision: flags, pauses, removals, refunds, releases and invites, with who did it and when.</p>
      <details className="collapse">
        <summary><span className="row" style={{ gap: 8 }}>Recent actions {rows && <span className="tab-count">{rows.length}{hasMore ? "+" : ""}</span>}</span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {rows === null && <span className="text-muted">Loading…</span>}
          {rows?.length === 0 && <span className="text-muted">Nothing yet.</span>}
          {rows?.map((a) => (
            <div key={a.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <span className="text-muted small nowrap" style={{ minWidth: 120 }}>{fmt(a.createdAt)}</span>
              <span className="grow small">{a.summary}</span>
              <span className="badge">{a.admin?.name || "System"}</span>
            </div>
          ))}
          {hasMore && rows && rows.length > 0 && (
            <button className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 10 }} onClick={() => load(rows[rows.length - 1].createdAt)}>Show older</button>
          )}
        </div>
      </details>
    </section>
  );
}
