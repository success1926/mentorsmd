"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MinorBadge, tintFor, initialsOf } from "@/components/ui";
import { fmtDateTime } from "@/lib/calls";
import { formatHasCall, money } from "@/lib/options";
import { ProfileChecklist } from "@/components/ProfileChecklist";
import { HoursBar, PackageBadge } from "@/components/Packages";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { PAYOUT_STATUS_LABEL, payoutDayLabel, periodLabel } from "@/lib/payoutRules";
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

const DAY = 24 * 3600_000;
const PAYOUT_BADGE: Record<string, string> = { PAID: "badge-success", FAILED: "badge-danger", PROCESSING: "badge-warning" };

type Attn = { key: string; tone: "" | "warn" | "danger"; text: string; href: string; cta: string };

function MentorDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const first = (session?.user?.name || "").split(" ")[0];

  const [earnings, setEarnings] = useState<any>(null);
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
    fetch("/api/me/payouts").then((r) => r.json()).then(setEarnings).catch(() => {});
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

  const activePkgs = (packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const approvedPkgs = (packages || []).filter((p) => finishPhase(p) === "APPROVED");

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
        <div className="stat-card"><span className="text-secondary">Active packages</span><span className="stat-num">{activePkgs.length}</span></div>
        <div className="stat-card" style={{ background: "var(--blue)" }}>
          <span className="text-secondary">Earned this month (not yet paid)</span>
          <span className="stat-num">{earnings ? money(earnings.unpaidCents) : "…"}</span>
          {earnings?.heldCents > 0 && <span className="text-muted small">+ {money(earnings.heldCents)} held by a dispute</span>}
        </div>
        <div className="stat-card" style={{ background: "var(--pink-soft)" }}>
          <span className="text-secondary">Next payout</span>
          <span className="stat-num">{earnings ? payoutDayLabel(earnings.nextPayoutDay) : "24th"}</span>
          {earnings && !earnings.payoutsConnected && <span className="text-muted small">Connect payouts to be paid</span>}
        </div>
        <div className="stat-card"><span className="text-secondary">Completed packages</span><span className="stat-num">{approvedPkgs.length}</span></div>
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
            <span className="text-muted small">You earn {100 - PLATFORM_FEE_PERCENT}% of each hour. Everything logged since your last payout, plus the unused hours of approved packages, is paid on the 24th of each month.</span>
          </section>

          <section className="stack-sm">
            <h2 style={{ fontSize: 28 }}>Past payouts</h2>
            {!earnings && <span className="text-muted">Loading…</span>}
            {earnings && earnings.past.length === 0 && <div className="empty">No payouts yet. Your first one is on {payoutDayLabel(earnings.nextPayoutDay)}.</div>}
            <div className="card" style={{ padding: "4px 20px" }} hidden={!earnings?.past?.length}>
              {(earnings?.past || []).map((p: any) => (
                <div key={p.id} className="list-row">
                  <div className="grow stack-sm" style={{ gap: 2 }}>
                    <b style={{ fontSize: 15 }}>{periodLabel(p.period)}</b>
                    <span className="text-muted small">{shortHours(p.minutes)}{p.paidAt ? ` · sent ${new Date(p.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span>
                  </div>
                  <b>{money(p.amountCents)}</b>
                  <span className={`badge ${PAYOUT_BADGE[p.status] || ""}`}>{p.status === "FAILED" ? "Delayed (we're on it)" : PAYOUT_STATUS_LABEL[p.status] || p.status}</span>
                </div>
              ))}
            </div>
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
