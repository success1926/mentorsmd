"use client";

// The student's Home (student area v2, Oct 2026; redesign section 8):
// "What's next" at the top gathers everything waiting on the student (a
// package marked complete with the hours left to respond, a call coming up
// soon, unread messages, the mentor suggesting more hours, running low on
// hours), then a card per active package (hours-left bar, Book a call /
// Message / Add hours), the calls coming up and the MentorsMD credit
// balance (only when there is some). With no packages: "Find your first
// mentor".
import { useEffect, useState } from "react";
import Link from "next/link";
import { AddHoursModal, BookCallModal, postJson, showLowHours } from "@/components/Packages";
import { PackageRow } from "@/components/PackageRow";
import { Alert, Icon, ICONS, LoadingBlock, PageHeader } from "@/components/ui";
import { notifyPackagesChanged, useNavStatus } from "@/components/NavStatus";
import { finishPhase, hoursToRespond, studentActions } from "@/lib/finishing";
import { hoursSummary, shortHours, TOP_UP_HOURS } from "@/lib/hours";
import { JOIN_OPENS_MINUTES_BEFORE, joinState } from "@/lib/calls";
import { firstName as first, fmtDateTime as fmtWhen, fmtTime, money } from "@/lib/format";
import { useConfirm } from "@/components/ConfirmDialog";

const DAY = 24 * 3600_000;

// "Suggested adding 2 hours to this package." from the mentor (see
// /api/orders/[id]/suggest-hours), if it's recent and no hours were added
// since. Returns the number of hours suggested.
function suggestedHours(p: any): number | null {
  const m = p.latestTheirs;
  if (!m?.body || finishPhase(p) !== "WORKING") return null;
  const match = /^Suggested adding (\d+) hours?\b/.exec(m.body);
  if (!match) return null;
  const at = new Date(m.createdAt).getTime();
  if (Date.now() - at > 7 * DAY) return null;
  if ((p.topUps || []).some((t: any) => t.paidAt && new Date(t.paidAt).getTime() > at)) return null;
  const n = Number(match[1]);
  return TOP_UP_HOURS.includes(n) ? n : null;
}

type Next = {
  key: string;
  tone: "" | "warn" | "danger" | "ok";
  icon: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  subTone?: "warn";
  actions: React.ReactNode;
};

export function StudentDashboard({ name }: { name: string; viewerId: string }) {
  const [packages, setPackages] = useState<any[] | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  // Unread messages and credit: the page's one status load (components/NavStatus.tsx).
  const status = useNavStatus();
  const credit = status?.student ? status.student.creditCents : null;
  const unread = status?.unread ?? 0;
  const [booking, setBooking] = useState<any>(null);
  const [adding, setAdding] = useState<{ order: any; hours?: number } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();

  function load() {
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages || [])).catch(() => setPackages([]));
    fetch("/api/me/calendar").then((r) => r.json()).then((d) => setCalls(d.upcoming || [])).catch(() => {});
  }
  useEffect(load, []);

  async function approve(p: any) {
    if (!(await confirm({ title: `Approve ${p.title}?`, body: `${first(p.seller?.name) || "Your mentor"} is paid for the hours, including any unused ones.`, confirmLabel: "Approve" }))) return;
    setBusy(p.id);
    setError("");
    const r = await postJson(`/api/orders/${p.id}/finish`, { action: "APPROVE", note: "" });
    setBusy("");
    if (!r.ok) return setError(r.data.error || "Something went wrong.");
    notifyPackagesChanged();
    load();
  }

  const now = Date.now();
  const all = packages || [];
  const active = all.filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const firstName = first(name);

  // ---------- What's next ----------
  const next: Next[] = [];
  for (const p of active.filter((p) => finishPhase(p) === "AWAITING_STUDENT")) {
    const left = hoursToRespond(p);
    const can = studentActions(p);
    next.push({
      key: `done${p.id}`,
      tone: "ok",
      icon: ICONS.check,
      title: <>{p.seller?.name} marked {p.title} complete</>,
      sub: `Respond in ${left} h, or it's approved automatically`,
      subTone: "warn",
      actions: (
        <>
          <button className="btn btn-sm btn-primary" disabled={busy === p.id} onClick={() => approve(p)}>Approve</button>
          <Link href={`/orders/${p.id}`} className="btn btn-sm">{can.lastRevision || can.lastCall ? "One last call or revision" : "Respond"}</Link>
        </>
      ),
    });
  }
  for (const p of active.filter((p) => finishPhase(p) === "DISPUTED")) {
    next.push({ key: `disp${p.id}`, tone: "warn", icon: ICONS.flag, title: <>Your dispute on {p.title} is open</>, sub: "The MentorsMD team is reviewing it. You can add details on the package page.", actions: <Link href={`/orders/${p.id}`} className="btn btn-sm">View</Link> });
  }
  for (const c of calls.filter((c) => new Date(c.startTime).getTime() - now < 2 * DAY)) {
    const open = joinState(c) === "open";
    next.push({
      key: `call${c.id}`,
      tone: "",
      icon: ICONS.video,
      title: open ? <>Your call with {c.withName} is open</> : <>Your call with {c.withName} starts {fmtWhen(c.startTime)}</>,
      sub: `${open ? "Join now" : `Join opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before`} · ${c.kind === "INTRO" ? "Free intro call" : c.title}`,
      actions: <Link href={`/calls/${c.id}`} className={`btn btn-sm ${open ? "btn-primary" : ""}`}>{open ? "Join call" : "Call page"}</Link>,
    });
  }
  let packageUnread = 0;
  for (const p of active.filter((p) => p.newMessages > 0)) {
    packageUnread += p.newMessages;
    next.push({
      key: `msg${p.id}`,
      tone: "danger",
      icon: ICONS.chat,
      title: <>{p.seller?.name} replied</>,
      sub: `${p.newMessages} new message${p.newMessages === 1 ? "" : "s"} · ${p.title}`,
      actions: <Link href={`/orders/${p.id}#messages`} className="btn btn-sm">Read</Link>,
    });
  }
  if (unread - packageUnread > 0) {
    const n = unread - packageUnread;
    next.push({ key: "msgs", tone: "danger", icon: ICONS.chat, title: <>You have {n} unread message{n === 1 ? "" : "s"}</>, actions: <Link href="/messages" className="btn btn-sm">Read</Link> });
  }
  for (const p of active) {
    const hours = suggestedHours(p);
    if (hours) {
      next.push({
        key: `sug${p.id}`,
        tone: "",
        icon: ICONS.clock,
        title: <>{p.seller?.name} suggested {hours} more hour{hours === 1 ? "" : "s"}</>,
        sub: `For ${p.title}${p.rateCents ? ` · ${money(p.rateCents)}/hr` : ""}`,
        actions: <button className="btn btn-sm" onClick={() => setAdding({ order: p, hours })}>Review</button>,
      });
    } else if (showLowHours(p)) {
      next.push({
        key: `low${p.id}`,
        tone: "warn",
        icon: ICONS.clock,
        title: <>{shortHours(hoursSummary(p).left)} left on {p.title}</>,
        sub: `with ${p.seller?.name} · booked calls count as used`,
        actions: <button className="btn btn-sm" onClick={() => setAdding({ order: p })}>Add hours</button>,
      });
    }
  }
  // The optional "About you", until it's filled in.
  if (status?.student && !status.student.profileFilled) {
    next.push({
      key: "about",
      tone: "",
      icon: ICONS.pen,
      title: <>Tell mentors a bit about you</>,
      sub: "When you apply, your stage and what you want help with. 1 minute, only your mentors see it.",
      actions: <Link href="/about-you" className="btn btn-sm">Add</Link>,
    });
  }

  return (
    <div className="page stack-lg" style={{ gap: 20 }}>
      {dialog}
      <PageHeader
        title={`Hi${firstName ? `, ${firstName}` : ""}`}
        lede="Your packages, calls and messages in one place."
        actions={<span className="text-muted small">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {packages !== null && next.length > 0 && (
        <section className="whats-next" aria-label="What's next">
          <div className="mentor-box-head">
            <h2 className="block-title">What&apos;s next</h2>
            <span className="text-muted small">{next.length} {next.length === 1 ? "thing" : "things"}</span>
          </div>
          {next.map((n) => (
            <div key={n.key} className="mentor-row" style={{ flexWrap: "wrap" }}>
              <span className={`mentor-row-icon ${n.tone}`}><Icon d={n.icon} size={16} /></span>
              <div className="grow stack-sm" style={{ gap: 0, minWidth: 200 }}>
                <b style={{ fontSize: 15 }}>{n.title}</b>
                {n.sub && <span className="small" style={{ color: n.subTone === "warn" ? "var(--warning-fg)" : "var(--muted)" }}>{n.sub}</span>}
              </div>
              <span className="row-wrap" style={{ gap: 6 }}>{n.actions}</span>
            </div>
          ))}
        </section>
      )}

      <div className="mentor-home-grid">
        <section className="mentor-box" style={{ minWidth: 0 }}>
          <div className="mentor-box-head">
            <h2>Your packages</h2>
            {all.length > 0 && <Link href="/orders" className="link small">All {all.length}</Link>}
          </div>
          {packages === null && <LoadingBlock title={false} lines={3} />}
          {packages !== null && active.length === 0 && (
            <div className="stack-sm" style={{ alignItems: "flex-start", padding: "12px 0" }}>
              <b className="block-title">{all.length ? "No active packages" : "Find your first mentor"}</b>
              <span className="text-secondary small">Message a mentor or book a free 15-minute intro call, then buy hours from their profile.</span>
              <Link href="/mentors" className="btn btn-primary btn-sm">Browse mentors</Link>
            </div>
          )}
          {active.map((p) => {
            const h = hoursSummary(p);
            return (
              <PackageRow
                key={p.id}
                p={p}
                audience="student"
                actions={
                  <>
                    {finishPhase(p) === "WORKING" && <button className="btn btn-sm btn-primary" disabled={h.left < 30} onClick={() => setBooking(p)}>Book a call</button>}
                    <Link href={`/orders/${p.id}#messages`} className="btn btn-sm">Message</Link>
                    {showLowHours(p) && <button className="btn btn-sm" onClick={() => setAdding({ order: p })}>Add hours</button>}
                  </>
                }
              />
            );
          })}
        </section>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section className="mentor-box">
            <div className="mentor-box-head">
              <h2>Coming up</h2>
              <Link href="/calendar" className="link small">Calendar</Link>
            </div>
            {calls.length === 0 && <span className="text-muted small" style={{ padding: "6px 0" }}>No calls booked.</span>}
            {calls.slice(0, 5).map((c) => {
              const d = new Date(c.startTime);
              const mins = Math.round((new Date(c.endTime).getTime() - d.getTime()) / 60_000);
              return (
                <Link key={c.id} href={`/calls/${c.id}`} className="mentor-row">
                  <span className="cal-date" style={{ minWidth: 52, padding: "6px 4px" }} aria-hidden="true">
                    <span className="small text-secondary">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <b style={{ fontSize: 18 }}>{d.getDate()}</b>
                  </span>
                  <div className="grow stack-sm" style={{ gap: 0, minWidth: 0 }}>
                    <b className="small">{c.withName} · {mins} min</b>
                    <span className="text-muted small">{fmtTime(d)} · {c.kind === "INTRO" ? "Free intro call" : c.title}</span>
                  </div>
                </Link>
              );
            })}
          </section>

          {credit !== null && credit > 0 && (
            <section className="mentor-box" style={{ gap: 6, background: "var(--tint-soft)" }}>
              <div className="mentor-box-head">
                <h2>MentorsMD credit</h2>
                <Link href="/credit" className="link small">History</Link>
              </div>
              <span className="stat-num">{money(credit)}</span>
              <span className="text-muted small">Used automatically at checkout, with any mentor. It never expires.</span>
            </section>
          )}
        </div>
      </div>

      {booking && (
        <BookCallModal
          open
          onClose={() => setBooking(null)}
          mentorId={booking.sellerId}
          mentorName={booking.seller?.name}
          mentorPhotoUrl={booking.seller?.photoUrl}
          orderId={booking.id}
          minutesLeft={hoursSummary(booking).left}
          onBooked={() => {
            notifyPackagesChanged();
            load();
          }}
        />
      )}
      {adding && <AddHoursModal open onClose={() => setAdding(null)} order={adding.order} initialHours={adding.hours} />}
    </div>
  );
}
