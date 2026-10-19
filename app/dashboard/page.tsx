"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MinorBadge, statusBadge, tintFor, initialsOf } from "@/components/ui";
import { callSummary, fmtDateTime } from "@/lib/calls";
import { formatHasCall, money } from "@/lib/options";
import { ProfileChecklist } from "@/components/ProfileChecklist";
import { HoursBar, PackageBadge } from "@/components/Packages";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { priceFor } from "@/lib/pricing";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { StudentDashboard } from "./StudentDashboard";

// One hours package on the mentor's dashboard (redesign Oct 2026).
function PackageRow({ p }: { p: any }) {
  const h = hoursSummary(p);
  return (
    <div className="list-row" style={{ flexWrap: "wrap" }}>
      <span className="avatar" style={{ background: tintFor(p.buyer?.name || ""), width: 40, height: 40, fontSize: 15 }}>{initialsOf(p.buyer?.name || "")}</span>
      <div className="grow stack-sm" style={{ gap: 4, minWidth: 200 }}>
        <b style={{ fontSize: 15 }}>{p.title}</b>
        <span className="text-muted">{p.buyer?.name} · {shortHours(h.left)} left of {shortHours(h.purchased)} · {h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held</span>
        <HoursBar order={p} thin />
      </div>
      <MinorBadge person={p.buyer} />
      <PackageBadge order={p} />
      {p.newMessages > 0 && <span className="count-badge" aria-label={`${p.newMessages} new messages`}>{p.newMessages}</span>}
      <Link href={`/orders/${p.id}`} className="btn btn-sm btn-soft">Open package</Link>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (user?.role === "BUYER") return <StudentDashboard name={user.name || ""} viewerId={user.id} />;
  return <MentorDashboard />;
}

const ACTIVE = ["IN_ESCROW", "COMPLETED"];
const DAY = 24 * 3600_000;

type Attn = { key: string; tone: "" | "warn" | "danger"; text: string; href: string; cta: string };

function OrderRow({ o }: { o: any }) {
  return (
    <div className="list-row" style={{ flexWrap: "wrap" }}>
      <span className="avatar" style={{ background: tintFor(o.buyer?.name || ""), width: 40, height: 40, fontSize: 15 }}>
        {initialsOf(o.buyer?.name || "")}
      </span>
      <div className="grow stack-sm" style={{ gap: 2, minWidth: 180 }}>
        <b style={{ fontSize: 15 }}>{o.gig.title}</b>
        <span className="text-muted">
          {o.buyer?.name} · {money(o.amount)}
          {o.dueDate && ACTIVE.includes(o.status) ? ` · Due ${new Date(o.dueDate).toLocaleDateString()}` : ""}
        </span>
      </div>
      <MinorBadge person={o.buyer} />
      {statusBadge(o)}
      <div className="row" style={{ gap: 6 }}>
        {o.conversationId && <Link href={`/messages/${o.conversationId}`} className="btn btn-sm">Message</Link>}
        <Link href={`/orders/${o.id}`} className="btn btn-sm btn-soft">Open order</Link>
      </div>
    </div>
  );
}

function MentorDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const first = (session?.user?.name || "").split(" ")[0];

  const [orders, setOrders] = useState<any[] | null>(null);
  const [convos, setConvos] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<boolean | null>(null);
  const [packages, setPackages] = useState<any[] | null>(null);
  const [toggling, setToggling] = useState(false);

  function loadProfile() {
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d.profile)).catch(() => {});
  }

  useEffect(() => {
    if (role !== "SELLER") return;
    fetch("/api/orders").then((r) => r.json()).then((d) => setOrders((d.orders || []).filter((o: any) => !["PENDING_PAYMENT", "CANCELLED"].includes(o.status)))).catch(() => setOrders([]));
    fetch("/api/conversations").then((r) => r.json()).then((d) => setConvos(d.conversations || [])).catch(() => {});
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages || [])).catch(() => setPackages([]));
    fetch("/api/gigs?mine=true").then((r) => r.json()).then((d) => setGigs(d.gigs || [])).catch(() => {});
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setPayouts(!!d.connected)).catch(() => {});
    loadProfile();
  }, [role]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (role !== "SELLER") {
    return (
      <div className="page-narrow">
        <div className="alert">The dashboard is for mentor and student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }

  const now = Date.now();
  const available = profile
    ? profile.profileStatus === "ACTIVE" || (profile.profileStatus === "PAUSED" && profile.pausedUntil && new Date(profile.pausedUntil).getTime() <= now)
    : true;

  async function toggleAvailable() {
    if (profile?.profileStatus === "REMOVED") return;
    setToggling(true);
    const res = await fetch("/api/profile/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: available ? "pause" : "unpause" }),
    });
    setToggling(false);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error || "Couldn't update availability");
    loadProfile();
  }

  // Orders from before the redesign (hours packages are listed separately).
  const list = (orders || []).filter((o) => !o.kind);
  const activePkgs = (packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const earnedCents = (packages || []).reduce((s, p) => s + Math.round((priceFor(hoursSummary(p).used, p.rateCents || 0) * (100 - PLATFORM_FEE_PERCENT)) / 100), 0);
  const active = list.filter((o) => ACTIVE.includes(o.status));
  const done = list.filter((o) => !ACTIVE.includes(o.status));
  const dueSoon = active.filter((o) => o.status === "IN_ESCROW" && o.dueDate && new Date(o.dueDate).getTime() - now < 7 * DAY);
  const heldCents = active.reduce((s, o) => s + Math.round(o.amount * 0.8), 0);

  const attn: Attn[] = [];
  if (payouts === false) attn.push({ key: "payouts", tone: "danger", text: "Connect payouts so students can book you.", href: "/dashboard/payouts", cta: "Connect" });
  // Profile sections and the hourly rate: the "Finish your profile"
  // checklist below shows each one.
  if (profile?.progress && !profile.progress.complete) attn.push({ key: "profile", tone: "warn", text: `Finish your profile (${profile.progress.done} of ${profile.progress.total} sections). Students can't find or buy from you until it's done.`, href: "/account", cta: "Finish" });
  if (profile?.hourlyRateCents && !gigs.some((g) => g.kind === "BUNDLE" || g.kind === "SPECIALIZED")) attn.push({ key: "gigs", tone: "warn", text: "Add hour bundles or a specialized package (optional).", href: "/dashboard/packages", cta: "Add offers" });
  if (profile && !profile.hasAvailability && gigs.some((g) => formatHasCall(g.format))) attn.push({ key: "cal", tone: "warn", text: "Set your call hours so students can book the calls in your packages.", href: "/account#call-hours", cta: "Set hours" });
  for (const p of activePkgs) {
    const who = p.buyer?.name?.split(" ")[0] || "Student";
    if (p.disputed) attn.push({ key: `pd${p.id}`, tone: "danger", text: `${who} opened a dispute on ${p.title}.`, href: `/orders/${p.id}`, cta: "View" });
    else if (finishPhase(p) === "WORKING" && p.lastRequestNote && (p.lastCallUsedAt || p.lastRevisionUsedAt)) attn.push({ key: `pl${p.id}`, tone: "warn", text: `${who} asked for ${p.lastCallUsedAt ? "one last call" : "one last revision"} on ${p.title}.`, href: `/orders/${p.id}`, cta: "Open" });
    const next = hoursSummary(p).upcoming[0];
    if (next && new Date(next.startTime).getTime() - now < DAY) attn.push({ key: `pc${next.id}`, tone: "", text: `Call with ${who}: ${fmtDateTime(next.startTime)}.`, href: `/orders/${p.id}`, cta: "Open" });
  }
  for (const o of active) {
    const c = callSummary(o);
    const who = o.buyer?.name?.split(" ")[0] || "Student";
    if (o.disputed) attn.push({ key: `d${o.id}`, tone: "danger", text: `${who} opened a dispute on ${o.gig.title}.`, href: `/orders/${o.id}`, cta: "View" });
    else if (c.onHold) attn.push({ key: `h${o.id}`, tone: "warn", text: `${o.gig.title} is on hold: ${who} hasn't booked the call.`, href: `/orders/${o.id}`, cta: "Review" });
    else if (o.status === "IN_ESCROW" && o.revisionRequested) attn.push({ key: `r${o.id}`, tone: "warn", text: `${who} asked for a revision on ${o.gig.title}.`, href: `/orders/${o.id}`, cta: "Open" });
    else if (o.status === "IN_ESCROW" && o.dueDate && new Date(o.dueDate).getTime() < now) attn.push({ key: `o${o.id}`, tone: "danger", text: `${o.gig.title} for ${who} is past due.`, href: `/orders/${o.id}`, cta: "Open" });
    const next = c.upcoming[0];
    if (next && new Date(next.startTime).getTime() - now < DAY) attn.push({ key: `c${next.id}`, tone: "", text: `Call with ${who}: ${fmtDateTime(next.startTime)}.`, href: `/orders/${o.id}`, cta: "Open" });
  }

  return (
    <div className="page stack-lg">
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="stack-sm">
          <h1 className="page-title">Hi{first ? `, ${first}` : ""}</h1>
          <p className="lede">Here&apos;s what&apos;s happening with your mentoring.</p>
          <div className="row" style={{ marginTop: 6 }}>
            <Link href="/dashboard/packages" className="btn btn-primary btn-sm">Rate &amp; offers</Link>
            <Link href="/account" className="btn btn-sm">Edit profile</Link>
          </div>
        </div>
        <div className="card row" style={{ padding: "14px 18px", gap: 14 }}>
          <label className="switch">
            <input type="checkbox" checked={available} disabled={toggling || profile?.profileStatus === "REMOVED"} onChange={toggleAvailable} aria-label="Available for new orders" />
            <span />
          </label>
          <div className="stack-sm" style={{ gap: 0 }}>
            <b>{profile?.profileStatus === "REMOVED" ? "Profile removed" : available ? "Available for new orders" : "Paused"}</b>
            <span className="text-muted">
              {profile?.profileStatus === "REMOVED"
                ? "Restore it from your account page"
                : available
                ? "You show up in search"
                : profile?.pausedUntil
                ? `Hidden until ${new Date(profile.pausedUntil).toLocaleDateString()}`
                : "Hidden from search"}
            </span>
          </div>
          <Link href="/account#availability" className="link small">Options</Link>
        </div>
      </div>

      <ProfileChecklist progress={profile?.progress} compact />

      <div className="stat-cards">
        <div className="stat-card"><span className="text-secondary">Active packages</span><span className="stat-num">{activePkgs.length + active.length}</span></div>
        <div className="stat-card" style={{ background: "var(--pink-soft)" }}><span className="text-secondary">Due in 7 days</span><span className="stat-num">{dueSoon.length}</span></div>
        <div className="stat-card" style={{ background: "var(--blue)" }}><span className="text-secondary">Held for you</span><span className="stat-num">{money(heldCents)}</span></div>
        <div className="stat-card"><span className="text-secondary">Completed</span><span className="stat-num">{done.filter((o) => o.status === "RELEASED").length}</span></div>
      </div>

      <div className="dash-grid">
        <div className="stack-lg" style={{ gap: 24 }}>
          <section className="stack-sm">
            <h2 style={{ fontSize: 28 }}>Needs your attention</h2>
            {attn.length === 0 ? (
              <div className="empty">You&apos;re all caught up.</div>
            ) : (
              attn.map((a) => (
                <div key={a.key} className="attn">
                  <span className={`attn-dot ${a.tone}`} />
                  <span className="grow">{a.text}</span>
                  <Link href={a.href} className="btn btn-sm">{a.cta}</Link>
                </div>
              ))
            )}
          </section>

          <section className="stack-sm">
            <h2 style={{ fontSize: 28 }}>Active packages</h2>
            {packages === null && <span className="text-muted">Loading…</span>}
            {packages !== null && activePkgs.length === 0 && <div className="empty">No active packages right now.</div>}
            <div className="card" style={{ padding: "4px 20px" }} hidden={!activePkgs.length}>
              {activePkgs.map((p) => <PackageRow key={p.id} p={p} />)}
            </div>
            {packages !== null && packages.length > 0 && (
              <span className="text-muted small">Earned on packages so far: {money(earnedCents)} ({100 - PLATFORM_FEE_PERCENT}% of hours used). Paid monthly, on the 24th.</span>
            )}
          </section>

          <section hidden={list.length === 0}>
            <details className="collapse" open>
              <summary>Active orders <span className="tab-count" style={{ marginRight: "auto", marginLeft: 8 }}>{active.length}</span></summary>
              <div className="collapse-body" style={{ gap: 0 }}>
                {orders === null && <span className="text-muted">Loading…</span>}
                {orders !== null && active.length === 0 && <span className="text-muted">No active orders right now.</span>}
                {active.map((o) => <OrderRow key={o.id} o={o} />)}
              </div>
            </details>
            <details className="collapse">
              <summary>Completed orders <span className="tab-count" style={{ marginRight: "auto", marginLeft: 8 }}>{done.length}</span></summary>
              <div className="collapse-body" style={{ gap: 0 }}>
                {done.length === 0 && <span className="text-muted">Nothing here yet.</span>}
                {done.map((o) => <OrderRow key={o.id} o={o} />)}
              </div>
            </details>
          </section>
        </div>

        <aside id="messages" className="card stack" style={{ gap: 4 }}>
          <div className="between" style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 18 }}>Messages</b>
            <Link href="/messages" className="link small">All messages</Link>
          </div>
          {convos.length === 0 && <span className="text-muted">When a student messages you, it shows up here.</span>}
          {convos.slice(0, 8).map((c) => {
            const last = c.messages?.[0];
            const unanswered = last && last.senderId !== (session?.user as any)?.id;
            const unread = c.sellerUnread || 0;
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className="list-row" style={{ padding: "12px 0" }}>
                <span className="avatar" style={{ background: tintFor(c.buyer?.id || ""), width: 38, height: 38, fontSize: 14 }}>{initialsOf(c.buyer?.name || "")}</span>
                <div className="grow stack-sm" style={{ gap: 0, minWidth: 0 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <b style={{ fontSize: 15, fontWeight: unread ? 700 : undefined }}>{c.buyer?.name}</b>
                    <MinorBadge person={c.buyer} />
                  </span>
                  <span className="text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last ? last.body || "Attachment" : "No messages yet"}</span>
                </div>
                {unread > 0 ? <span className="count-badge" aria-label={`${unread} unread`}>{unread}</span> : unanswered && <span className="attn-dot" aria-label="Waiting on your reply" />}
              </Link>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
