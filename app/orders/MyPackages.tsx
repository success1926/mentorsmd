"use client";

// Student "My packages" (/orders), redesign Oct 2026 (docs/redesign-2026-10.md
// section 8), reorganized in student area v2: on the left every package
// with tabs Active / Waiting on you / Completed (title, mentor, hours-left
// bar, status, new messages); on the right the selected package (48-hour
// decision, hours left split into calls / written work / booked, Book a
// call / Add hours, next call, latest messages, shared files, hours log)
// and "Full page" (/orders/[id]). On a phone: the list, then the package.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/options";
import { AddHoursModal, BookCallModal, DecisionBanner, HoursBar, HoursLog, LowHoursBadge, PackageBadge, SharedFiles, fmtDay, fmtWhen } from "@/components/Packages";
import { tintFor, initialsOf } from "@/components/ui";
import { notifyPackagesChanged } from "@/components/StudentShell";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { KIND_LABEL, hoursLabel } from "@/lib/pricing";

type Filter = "active" | "waiting" | "done";

function inFilter(p: any, f: Filter) {
  const phase = finishPhase(p);
  if (f === "waiting") return phase === "AWAITING_STUDENT";
  if (f === "active") return phase === "WORKING" || phase === "AWAITING_STUDENT" || phase === "DISPUTED";
  return phase === "APPROVED" || phase === "CLOSED";
}

// The latest things that happened on a package, newest first.
export function recentActivity(p: any, viewerId: string, max = 6) {
  const items: { at: string; text: string }[] = [];
  for (const e of p.hourEntries || []) {
    if (e.voidedAt) continue;
    items.push({ at: e.createdAt, text: e.type === "CALL" ? `Call logged (${e.minutes} min)` : `${e.minutes} min of written work logged${e.note ? `: ${e.note}` : ""}` });
  }
  for (const b of p.callBookings || []) {
    if (b.status === "CANCELLED") continue;
    if (new Date(b.endTime) > new Date()) items.push({ at: b.createdAt || b.startTime, text: `Call booked for ${fmtWhen(b.startTime)}` });
  }
  for (const t of p.topUps || []) if (t.paidAt) items.push({ at: t.paidAt, text: `${hoursLabel(t.minutes)} added` });
  if (p.markedCompleteAt) items.push({ at: p.markedCompleteAt, text: "Marked complete by your mentor" });
  if (p.approvedAt) items.push({ at: p.approvedAt, text: p.autoApproved ? "Approved automatically" : "Approved" });
  if (p.latestMessage) items.push({ at: p.latestMessage.createdAt, text: `${p.latestMessage.senderId === viewerId ? "You" : "New message"}: ${p.latestMessage.body || p.latestMessage.attachmentName || "a file"}` });
  items.push({ at: p.paidAt || p.createdAt, text: "Package started" });
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, max);
}

export function MyPackages({ viewerId }: { viewerId: string }) {
  const [packages, setPackages] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [selected, setSelected] = useState<string>("");
  const [showDetail, setShowDetail] = useState(false);
  const [booking, setBooking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [credit, setCredit] = useState(0);

  function load() {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => setPackages((p) => p ?? []));
  }
  function changed() {
    notifyPackagesChanged();
    load();
  }
  useEffect(() => {
    load();
    // MentorsMD credit balance (the ledger, lib/credit.ts).
    fetch("/api/me/credit").then((r) => r.json()).then((d) => setCredit(d.balanceCents || 0)).catch(() => {});
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setSelected(id);
      setShowDetail(true);
    }
  }, []);

  const counts = useMemo(() => {
    const list = packages || [];
    return { active: list.filter((p) => inFilter(p, "active")).length, waiting: list.filter((p) => inFilter(p, "waiting")).length, done: list.filter((p) => inFilter(p, "done")).length };
  }, [packages]);
  // Start on "Waiting on you" when something needs an answer.
  useEffect(() => {
    if (packages && counts.waiting > 0 && !selected) setFilter("waiting");
  }, [packages, counts.waiting, selected]);

  const list = (packages || []).filter((p) => inFilter(p, filter));
  const current = (packages || []).find((p) => p.id === selected) || list[0] || null;

  if (packages === null) return <div className="page text-muted">Loading…</div>;

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="between" style={{ marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="stack-sm">
          <h1 className="page-title">My packages</h1>
          <p className="lede">Everything you&apos;ve bought, with hours, calls, messages and files.</p>
        </div>
        <div className="row-wrap">
          {credit > 0 && <Link href="/credit" className="badge badge-brand" title="Applied automatically at checkout, with any mentor. Never expires.">MentorsMD credit: {money(credit)}</Link>}
          <Link href="/mentors" className="btn btn-primary">Find a mentor</Link>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <b>No packages yet</b>
          <span className="text-secondary">Message a mentor or book a free 15-minute intro call, then buy hours or a package from their profile.</span>
          <Link href="/mentors" className="btn btn-primary">Browse mentors</Link>
        </div>
      ) : (
        <div className={`pkg-panes ${showDetail ? "has-detail" : ""}`}>
          <div className="pkg-list">
            <div className="pkg-filters" role="tablist">
              {([["active", "Active"], ["waiting", "Waiting on you"], ["done", "Completed"]] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={filter === k} className={`btn btn-sm ${filter === k ? "btn-primary" : ""}`} onClick={() => setFilter(k)}>
                  {label} <span className="tab-count">{counts[k]}</span>
                </button>
              ))}
            </div>
            {list.length === 0 && <p className="text-muted" style={{ padding: 20 }}>{filter === "waiting" ? "Nothing needs your answer right now." : filter === "active" ? "No active packages." : "No completed packages yet."}</p>}
            {list.map((p) => {
              const h = hoursSummary(p);
              return (
                <button key={p.id} className="pkg-item" aria-current={current?.id === p.id ? "true" : undefined} onClick={() => { setSelected(p.id); setShowDetail(true); }}>
                  <div className="between" style={{ alignItems: "flex-start", gap: 8 }}>
                    <b style={{ fontSize: 15 }}>{p.title}</b>
                    {p.newMessages > 0 && <span className="count-badge" aria-label={`${p.newMessages} new messages`}>{p.newMessages}</span>}
                  </div>
                  <span className="text-muted small">
                    {p.seller?.name}
                    {p.newMessages > 0 ? ` · ${p.newMessages} new message${p.newMessages === 1 ? "" : "s"}` : ""}
                  </span>
                  <HoursBar order={p} thin />
                  <div className="between small">
                    <span className="text-secondary">{shortHours(h.left)} left of {shortHours(h.purchased)}</span>
                    <span className="row" style={{ gap: 6 }}><LowHoursBadge order={p} /><PackageBadge order={p} /></span>
                  </div>
                </button>
              );
            })}
            <p className="text-muted small" style={{ padding: "12px 18px" }}>
              Waiting on you: packages your mentor marked complete. Completed packages stay here with their messages and files.
            </p>
          </div>

          <div className="pkg-detail">
            {current ? (
              <PackageSummary
                key={current.id}
                p={current}
                viewerId={viewerId}
                onBack={() => setShowDetail(false)}
                onBook={() => setBooking(true)}
                onAdd={() => setAdding(true)}
                onChanged={changed}
              />
            ) : (
              <span className="text-muted">Pick a package.</span>
            )}
          </div>
        </div>
      )}

      {current && (
        <>
          <BookCallModal open={booking} onClose={() => setBooking(false)} mentorId={current.sellerId} mentorName={current.seller?.name} mentorPhotoUrl={current.seller?.photoUrl} orderId={current.id} minutesLeft={hoursSummary(current).left} onBooked={changed} />
          <AddHoursModal open={adding} onClose={() => setAdding(false)} order={current} />
        </>
      )}
    </div>
  );
}


function PackageSummary({ p, viewerId, onBack, onBook, onAdd, onChanged }: { p: any; viewerId: string; onBack: () => void; onBook: () => void; onAdd: () => void; onChanged: () => void }) {
  const h = hoursSummary(p);
  const phase = finishPhase(p);
  const next = h.upcoming[0];
  const mentor = p.seller;
  // Shared files and the hours log (with who logged each entry) come from
  // the package itself, loaded when it's opened here.
  const [full, setFull] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/orders/${p.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.order && setFull(d.order))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [p.id, p.hourEntries?.length, p.filesCount]);
  const theirs = p.latestTheirs;
  const mine = p.latestMessage && p.latestMessage.senderId === viewerId ? p.latestMessage : null;
  const preview = [theirs, mine].filter(Boolean).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const entries = full?.hourEntries || p.hourEntries || [];

  return (
    <>
      <button className="btn btn-ghost btn-sm pkg-back" style={{ alignSelf: "flex-start" }} onClick={onBack}>← All packages</button>
      <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
        {mentor?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mentor.photoUrl} alt="" className="avatar" style={{ objectFit: "cover" }} />
        ) : (
          <span className="avatar" style={{ background: tintFor(mentor?.id || "") }}>{initialsOf(mentor?.name || "")}</span>
        )}
        <div className="stack-sm grow" style={{ gap: 2, minWidth: 0 }}>
          <span className="text-muted small">{KIND_LABEL[p.kind] || "Package"} · with {mentor?.name}</span>
          <h2 style={{ fontSize: 26 }}>{p.title}</h2>
        </div>
        <span className="row" style={{ gap: 8 }}>
          <PackageBadge order={p} />
          <Link href={`/orders/${p.id}`} className="btn btn-sm">Full page</Link>
        </span>
      </div>

      <DecisionBanner order={p} isBuyer onChanged={onChanged} />

      <section className="mentor-box" style={{ gap: 10 }}>
        <div className="between" style={{ alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <span>
            <span className="stat-num">{shortHours(h.left)}</span> <b>left</b>
            <span className="text-secondary"> of {shortHours(h.purchased)}{p.rateCents ? ` · ${money(p.rateCents)}/hr` : ""}</span>
          </span>
          <LowHoursBadge order={p} />
        </div>
        <HoursBar order={p} />
        <span className="text-secondary small">
          Calls {shortHours(h.usedCalls)} · Written {shortHours(h.usedWritten)} · Booked {shortHours(h.reserved)} · {h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held
        </span>
        {(phase === "WORKING" || phase === "AWAITING_STUDENT") && (
          <div className="row-wrap" style={{ alignItems: "center" }}>
            {phase === "WORKING" && <button className="btn btn-sm btn-primary" disabled={h.left < 30} onClick={onBook}>Book a call</button>}
            <button className="btn btn-sm" onClick={onAdd}>Add hours</button>
            {phase === "WORKING" && <span className="text-muted small">Calls use your hours. No payment needed.</span>}
          </div>
        )}
        {next && (
          <span className="small" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            Next call: <b>{fmtWhen(next.startTime)}</b> · {Math.round((new Date(next.endTime).getTime() - new Date(next.startTime).getTime()) / 60_000)} min ·{" "}
            <Link className="link" href={`/calls/${next.id}`}>Call page</Link>
          </span>
        )}
      </section>

      <section className="mentor-box" style={{ gap: 8 }}>
        <div className="mentor-box-head">
          <h2>Messages {p.newMessages > 0 && <span className="badge badge-brand" style={{ marginLeft: 6 }}>{p.newMessages} new</span>}</h2>
          <Link href={`/orders/${p.id}#messages`} className="link small">Open conversation</Link>
        </div>
        {preview.length === 0 ? (
          <span className="text-muted small">No messages on this package yet. Messages and files you send on the package page stay with it.</span>
        ) : (
          preview.map((m: any) => (
            <div key={m.id} className="small ph-no-capture" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <b>{m.senderId === viewerId ? "You" : (mentor?.name || "").split(" ")[0]}:</b>{" "}
              <span className="text-secondary">{m.body || m.attachmentName || "Sent a file"}</span>
              <span className="text-muted"> · {fmtDay(m.createdAt)}</span>
            </div>
          ))
        )}
      </section>

      <section className="mentor-box" style={{ gap: 8 }}>
        <div className="mentor-box-head"><h2>Shared files</h2></div>
        {full ? <SharedFiles files={full.files || []} viewerId={viewerId} /> : <span className="text-muted small">{p.filesCount ? "Loading…" : "No files shared yet."}</span>}
      </section>

      <details className="collapse">
        <summary>Hours log ({entries.length} {entries.length === 1 ? "entry" : "entries"})</summary>
        <div className="collapse-body">
          <HoursLog entries={entries} />
        </div>
      </details>

      <div className="stack-sm">
        <b className="small">Recent activity</b>
        {recentActivity(p, viewerId, 4).map((a, i) => (
          <div key={i} className="between small link-row" style={{ gap: 12 }}>
            <span className="text-secondary" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</span>
            <span className="text-muted nowrap">{fmtDay(a.at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
