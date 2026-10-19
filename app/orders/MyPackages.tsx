"use client";

// Student "My packages" (/orders), redesign Oct 2026 (docs/redesign-2026-10.md
// section 8): on the left every package with filters Active / Waiting on
// you / Completed (title, mentor, hours-left bar, status badge, new
// messages); on the right the selected package's summary (48-hour banner,
// hours left, calls held, shared files, Message · share a file / Book a
// call / Add hours, recent activity) and "Open full package page". On a
// phone: the list, then the package.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/options";
import { AddHoursModal, BookCallModal, DecisionBanner, HoursBar, LowHoursBadge, PackageBadge, fmtDay, fmtWhen } from "@/components/Packages";
import { tintFor, initialsOf } from "@/components/ui";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { hoursLabel } from "@/lib/pricing";

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
    <div className="page" style={{ paddingTop: 32 }}>
      <div className="between" style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className="page-title" style={{ fontSize: 40 }}>My packages</h1>
        <div className="row-wrap">
          {credit > 0 && <span className="badge badge-brand" title="Applied automatically at checkout, with any mentor. Never expires.">MentorsMD credit: {money(credit)}</span>}
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
                  <span className="text-muted small">{p.seller?.name}</span>
                  <HoursBar order={p} thin />
                  <div className="between small">
                    <span className="text-secondary">{shortHours(h.left)} left of {shortHours(h.purchased)}</span>
                    <span className="row" style={{ gap: 6 }}><LowHoursBadge order={p} /><PackageBadge order={p} /></span>
                  </div>
                </button>
              );
            })}
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
                onChanged={load}
              />
            ) : (
              <span className="text-muted">Pick a package.</span>
            )}
          </div>
        </div>
      )}

      {current && (
        <>
          <BookCallModal open={booking} onClose={() => setBooking(false)} mentorId={current.sellerId} mentorName={current.seller?.name} orderId={current.id} minutesLeft={hoursSummary(current).left} onBooked={load} />
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
  return (
    <>
      <button className="btn btn-ghost btn-sm pkg-back" style={{ alignSelf: "flex-start" }} onClick={onBack}>← All packages</button>
      <div className="row" style={{ gap: 14 }}>
        {mentor?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mentor.photoUrl} alt="" className="avatar" style={{ objectFit: "cover" }} />
        ) : (
          <span className="avatar" style={{ background: tintFor(mentor?.id || "") }}>{initialsOf(mentor?.name || "")}</span>
        )}
        <div className="stack-sm grow" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 26 }}>{p.title}</h2>
          <span className="text-secondary">with {mentor?.name}</span>
        </div>
        <PackageBadge order={p} />
      </div>

      <DecisionBanner order={p} isBuyer onChanged={onChanged} />

      <div className="stat-cards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="stat-card"><span className="text-secondary">Hours left</span><span className="stat-num">{shortHours(h.left)}</span></div>
        <div className="stat-card" style={{ background: "var(--blue)" }}><span className="text-secondary">Calls held</span><span className="stat-num">{h.callsHeld}</span></div>
        <div className="stat-card" style={{ background: "var(--pink-soft)" }}><span className="text-secondary">Shared files</span><span className="stat-num">{p.filesCount}</span></div>
      </div>
      <HoursBar order={p} />
      {next && <span className="small">Next call: <b>{fmtWhen(next.startTime)}</b> · <Link className="link" href={`/calls/${next.id}`}>Call page</Link></span>}

      <div className="row-wrap">
        <Link href={`/orders/${p.id}#messages`} className="btn btn-sm">Message · share a file{p.newMessages ? ` (${p.newMessages} new)` : ""}</Link>
        {phase === "WORKING" && <button className="btn btn-sm btn-primary" disabled={h.left < 30} onClick={onBook}>Book a call</button>}
        {(phase === "WORKING" || phase === "AWAITING_STUDENT") && <button className="btn btn-sm" onClick={onAdd}>Add hours</button>}
      </div>

      <div className="stack-sm">
        <b>Recent activity</b>
        {recentActivity(p, viewerId).map((a, i) => (
          <div key={i} className="between small link-row" style={{ gap: 12 }}>
            <span className="text-secondary" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</span>
            <span className="text-muted nowrap">{fmtDay(a.at)}</span>
          </div>
        ))}
      </div>

      <Link href={`/orders/${p.id}`} className="btn btn-deep" style={{ alignSelf: "flex-start" }}>Open full package page</Link>
    </>
  );
}
