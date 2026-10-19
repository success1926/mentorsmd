"use client";

// The student's dashboard (redesign Oct 2026, docs/redesign-2026-10.md
// section 8): a card per active package (hours left, new messages, the
// latest message, Message · share a file / Book a call / Open package),
// "Coming up" calls, and the MentorsMD credit balance.
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookCallModal, HoursBar, PackageBadge, fmtWhen } from "@/components/Packages";
import { tintFor, initialsOf } from "@/components/ui";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { money } from "@/lib/options";

export function StudentDashboard({ name, viewerId }: { name: string; viewerId: string }) {
  const [packages, setPackages] = useState<any[] | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [credit, setCredit] = useState<number | null>(null);
  const [booking, setBooking] = useState<any>(null);

  function load() {
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages || [])).catch(() => setPackages([]));
    fetch("/api/me/calendar").then((r) => r.json()).then((d) => setCalls(d.upcoming || [])).catch(() => {});
    fetch("/api/me/credit").then((r) => r.json()).then((d) => setCredit(d.balanceCents || 0)).catch(() => setCredit(0));
  }
  useEffect(load, []);

  const active = (packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const waiting = active.filter((p) => finishPhase(p) === "AWAITING_STUDENT");
  const first = name.split(" ")[0];

  return (
    <div className="page stack-lg">
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="stack-sm">
          <h1 className="page-title">Hi{first ? `, ${first}` : ""}</h1>
          <p className="lede">Your packages, calls and messages in one place.</p>
        </div>
        <div className="row-wrap">
          <Link href="/orders" className="btn btn-sm">My packages</Link>
          <Link href="/messages" className="btn btn-sm">Messages</Link>
          <Link href="/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>
        </div>
      </div>

      {waiting.map((p) => (
        <div key={p.id} className="attn">
          <span className="attn-dot warn" />
          <span className="grow">{p.seller?.name?.split(" ")[0]} marked <b>{p.title}</b> complete. Approve it, or ask for one last call or revision.</span>
          <Link href={`/orders/${p.id}`} className="btn btn-sm">Respond</Link>
        </div>
      ))}

      <div className="dash-grid">
        <section className="stack" style={{ gap: 16 }}>
          <h2 style={{ fontSize: 28 }}>Active packages</h2>
          {packages === null && <span className="text-muted">Loading…</span>}
          {packages !== null && active.length === 0 && (
            <div className="empty stack" style={{ alignItems: "center" }}>
              <span>No active packages.</span>
              <span className="text-secondary small">Message a mentor or book a free 15-minute intro call, then buy hours from their profile.</span>
              <Link href="/mentors" className="btn btn-primary btn-sm">Browse mentors</Link>
            </div>
          )}
          <div className="pkg-cards">
            {active.map((p) => {
              const h = hoursSummary(p);
              const m = p.latestMessage;
              return (
                <div key={p.id} className="card pkg-card">
                  <div className="row" style={{ gap: 12 }}>
                    {p.seller?.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.seller.photoUrl} alt="" className="avatar" style={{ width: 40, height: 40, objectFit: "cover" }} />
                    ) : (
                      <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: tintFor(p.seller?.id || "") }}>{initialsOf(p.seller?.name || "")}</span>
                    )}
                    <div className="grow stack-sm" style={{ gap: 0, minWidth: 0 }}>
                      <b style={{ fontSize: 16 }}>{p.title}</b>
                      <span className="text-muted small">{p.seller?.name}</span>
                    </div>
                    <PackageBadge order={p} />
                  </div>
                  <HoursBar order={p} />
                  <div className="between small">
                    <span><b>{shortHours(h.left)}</b> <span className="text-secondary">left of {shortHours(h.purchased)}</span></span>
                    {p.newMessages > 0 ? <span className="badge badge-brand">{p.newMessages} new message{p.newMessages === 1 ? "" : "s"}</span> : <span className="text-muted">{h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held</span>}
                  </div>
                  {m && (
                    <span className="text-secondary small ph-no-capture" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.senderId === viewerId ? "You: " : ""}{m.body || m.attachmentName || "Sent a file"}
                    </span>
                  )}
                  <div className="row-wrap">
                    <Link href={`/orders/${p.id}#messages`} className="btn btn-sm">Message · share a file</Link>
                    {finishPhase(p) === "WORKING" && <button className="btn btn-sm btn-primary" disabled={h.left < 30} onClick={() => setBooking(p)}>Book a call</button>}
                    <Link href={`/orders/${p.id}`} className="btn btn-sm btn-soft">Open package</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="stack" style={{ gap: 16 }}>
          <div className="card stack-sm">
            <b style={{ fontSize: 18 }}>Coming up</b>
            {calls.length === 0 && <span className="text-muted small">No calls booked.</span>}
            {calls.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/calls/${c.id}`} className="list-row" style={{ padding: "10px 0" }}>
                <div className="grow stack-sm" style={{ gap: 0 }}>
                  <b className="small">{fmtWhen(c.startTime)}</b>
                  <span className="text-muted small">{c.title} · with {c.withName}</span>
                </div>
              </Link>
            ))}
            <Link href="/calendar" className="link small">My calendar</Link>
          </div>
          <div className="card stack-sm" style={{ background: "var(--tint-soft)" }}>
            <span className="text-secondary">MentorsMD credit</span>
            <span className="stat-num">{credit === null ? "…" : money(credit)}</span>
            <span className="text-muted small">Used automatically at checkout, with any mentor. It never expires.</span>
          </div>
        </aside>
      </div>

      {booking && (
        <BookCallModal open onClose={() => setBooking(null)} mentorId={booking.sellerId} mentorName={booking.seller?.name} orderId={booking.id} minutesLeft={hoursSummary(booking).left} onBooked={load} />
      )}
    </div>
  );
}
