"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { statusBadge, tintFor, initialsOf } from "@/components/ui";
import { callSummary, fmtDateTime } from "@/lib/calls";
import { formatHasCall, money } from "@/lib/options";

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
      {statusBadge(o)}
      <div className="row" style={{ gap: 6 }}>
        {o.conversationId && <Link href={`/messages/${o.conversationId}`} className="btn btn-sm">Message</Link>}
        <Link href={`/orders/${o.id}`} className="btn btn-sm btn-soft">Open order</Link>
      </div>
    </div>
  );
}

export default function MentorDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const first = (session?.user?.name || "").split(" ")[0];

  const [orders, setOrders] = useState<any[] | null>(null);
  const [convos, setConvos] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  function loadProfile() {
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d.profile)).catch(() => {});
  }

  useEffect(() => {
    if (role !== "SELLER") return;
    fetch("/api/orders").then((r) => r.json()).then((d) => setOrders((d.orders || []).filter((o: any) => !["PENDING_PAYMENT", "CANCELLED"].includes(o.status)))).catch(() => setOrders([]));
    fetch("/api/conversations").then((r) => r.json()).then((d) => setConvos(d.conversations || [])).catch(() => {});
    fetch("/api/gigs?mine=true").then((r) => r.json()).then((d) => setGigs(d.gigs || [])).catch(() => {});
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setPayouts(!!d.connected)).catch(() => {});
    loadProfile();
  }, [role]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (role !== "SELLER") {
    return (
      <div className="page-narrow">
        <div className="alert">The dashboard is for mentor accounts. <Link href="/orders" className="link">Go to my orders</Link></div>
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

  const list = orders || [];
  const active = list.filter((o) => ACTIVE.includes(o.status));
  const done = list.filter((o) => !ACTIVE.includes(o.status));
  const dueSoon = active.filter((o) => o.status === "IN_ESCROW" && o.dueDate && new Date(o.dueDate).getTime() - now < 7 * DAY);
  const heldCents = active.reduce((s, o) => s + Math.round(o.amount * 0.8), 0);

  const attn: Attn[] = [];
  if (payouts === false) attn.push({ key: "payouts", tone: "danger", text: "Connect payouts so students can book you.", href: "/dashboard/payouts", cta: "Connect" });
  if (profile && (!profile.mentorStage || !profile.schoolType)) attn.push({ key: "q", tone: "warn", text: "Answer the mentor questions. Your packages are hidden from search until you do.", href: "/account#search", cta: "Answer" });
  if (gigs.length === 0) attn.push({ key: "gigs", tone: "warn", text: "Create your first package.", href: "/dashboard/packages?new=1", cta: "Add package" });
  if (profile && !profile.calLink && gigs.some((g) => formatHasCall(g.format))) attn.push({ key: "cal", tone: "", text: "Connect Cal.com so students can book the calls in your packages.", href: "/account#calendar", cta: "Connect" });
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
            <Link href="/dashboard/packages?new=1" className="btn btn-primary btn-sm">+ Add package</Link>
            {gigs.length > 0 && <Link href="/dashboard/packages" className="btn btn-sm">My packages</Link>}
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

      <div className="stat-cards">
        <div className="stat-card"><span className="text-secondary">Active orders</span><span className="stat-num">{active.length}</span></div>
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

          <section>
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
                  <b style={{ fontSize: 15, fontWeight: unread ? 700 : undefined }}>{c.buyer?.name}</b>
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
