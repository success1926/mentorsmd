"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon, ICONS, MinorBadge, tintFor, initialsOf } from "@/components/ui";
import { fmtDateTime } from "@/lib/calls";
import { formatHasCall, money } from "@/lib/options";
import { HoursBar, LowHoursBadge, PackageBadge, showLowHours } from "@/components/Packages";
import { UpcomingCalls } from "@/components/UpcomingCalls";
import { PreviewProfileButton } from "@/components/MentorShell";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { payoutDayLabel } from "@/lib/payoutRules";
import { StudentDashboard } from "./StudentDashboard";

// One active package on the mentor home (student, title, hours left).
function PackageRow({ p }: { p: any }) {
  const h = hoursSummary(p);
  return (
    <Link href={`/orders/${p.id}`} className="mentor-row" style={{ flexWrap: "wrap" }}>
      <span className="avatar" style={{ background: tintFor(p.buyer?.name || ""), width: 34, height: 34, fontSize: 13 }}>{initialsOf(p.buyer?.name || "")}</span>
      <div className="grow stack-sm" style={{ gap: 4, minWidth: 180 }}>
        <span className="row-wrap" style={{ gap: 6, fontSize: 15 }}>
          <b>{p.buyer?.name}</b> · {p.title} <MinorBadge person={p.buyer} />
        </span>
        <HoursBar order={p} thin />
      </div>
      <span className="text-muted small nowrap">{shortHours(h.left)} left of {shortHours(h.purchased)}</span>
      <LowHoursBadge order={p} />
      {finishPhase(p) !== "WORKING" && <PackageBadge order={p} />}
      {p.newMessages > 0 && <span className="count-badge" aria-label={`${p.newMessages} new messages`}>{p.newMessages}</span>}
    </Link>
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

type Attn = { key: string; tone: "" | "warn" | "danger" | "ok"; icon: string; title: string; sub?: string; href: string; cta: string };

// Mentor home (mentor area v2, Oct 2026): "Finish your profile" (only while
// it's incomplete), Needs your attention, this week's calls, active
// students & packages, and earnings. The old "Available for new orders"
// switch was the same as Pause, so it's only in Settings now.
function MentorDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role;
  const viewerId = (session?.user as any)?.id;
  const first = (session?.user?.name || "").split(" ")[0];

  const [earnings, setEarnings] = useState<any>(null);
  const [convos, setConvos] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<boolean | null>(null);
  const [packages, setPackages] = useState<any[] | null>(null);
  const [calls, setCalls] = useState<any[] | null>(null);

  useEffect(() => {
    if (role !== "SELLER") return;
    fetch("/api/me/payouts").then((r) => r.json()).then(setEarnings).catch(() => {});
    fetch("/api/conversations").then((r) => r.json()).then((d) => setConvos(d.conversations || [])).catch(() => {});
    fetch("/api/packages").then((r) => r.json()).then((d) => setPackages(d.packages || [])).catch(() => setPackages([]));
    fetch("/api/gigs?mine=true").then((r) => r.json()).then((d) => setGigs(d.gigs || [])).catch(() => {});
    fetch("/api/stripe/status").then((r) => r.json()).then((d) => setPayouts(!!d.connected)).catch(() => {});
    fetch("/api/me/calendar").then((r) => r.json()).then((d) => setCalls(d.upcoming || [])).catch(() => setCalls([]));
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d.profile)).catch(() => {});
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
  const activePkgs = (packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const progress = profile?.progress as { sections: any[]; done: number; total: number; complete: boolean } | undefined;
  const missing = (progress?.sections || []).filter((s) => !s.done);

  const attn: Attn[] = [];
  if (payouts === false) attn.push({ key: "payouts", tone: "danger", icon: ICONS.lock, title: "Connect payouts", sub: "Students can't buy from you until your bank account is connected.", href: "/dashboard/payouts", cta: "Connect" });
  if (profile?.hourlyRateCents && !gigs.some((g) => g.kind === "BUNDLE" || g.kind === "SPECIALIZED")) attn.push({ key: "gigs", tone: "", icon: ICONS.pen, title: "Add hour bundles or a specialized package", sub: "Optional, but students like choices.", href: "/dashboard/packages", cta: "Add offers" });
  if (profile && !profile.hasAvailability && gigs.some((g) => formatHasCall(g.format))) attn.push({ key: "cal", tone: "warn", icon: ICONS.calendar, title: "Set your call hours", sub: "So students can book the calls in your packages.", href: "/dashboard/availability#call-hours", cta: "Set hours" });
  // Students waiting on a reply (the last message in the thread is theirs).
  for (const c of convos) {
    const last = c.messages?.[0];
    if (!last || last.senderId === viewerId || !(c.sellerUnread > 0 || now - new Date(last.createdAt).getTime() < 7 * DAY)) continue;
    const hours = Math.max(1, Math.round((now - new Date(last.createdAt).getTime()) / 3600_000));
    attn.push({ key: `m${c.id}`, tone: "danger", icon: ICONS.chat, title: `Reply to ${c.buyer?.name?.split(" ")[0] || "your student"}`, sub: `Waiting ${hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`}`, href: `/messages/${c.id}`, cta: "Reply" });
  }
  for (const p of activePkgs) {
    const who = p.buyer?.name?.split(" ")[0] || "Student";
    if (p.disputed) attn.push({ key: `pd${p.id}`, tone: "danger", icon: ICONS.flag, title: `${who} opened a dispute`, sub: p.title, href: `/orders/${p.id}`, cta: "View" });
    else if (finishPhase(p) === "WORKING" && p.lastRequestNote && (p.lastCallUsedAt || p.lastRevisionUsedAt)) attn.push({ key: `pl${p.id}`, tone: "warn", icon: ICONS.cycle, title: `${who} asked for ${p.lastCallUsedAt ? "one last call" : "one last revision"}`, sub: p.title, href: `/orders/${p.id}`, cta: "Open" });
    else if (showLowHours(p)) attn.push({ key: `pw${p.id}`, tone: "warn", icon: ICONS.clock, title: `${who} has ${shortHours(hoursSummary(p).left)} left`, sub: `Suggest a top-up or a final call · ${p.title}`, href: `/orders/${p.id}`, cta: "Open package" });
    const next = hoursSummary(p).upcoming[0];
    if (next && new Date(next.startTime).getTime() - now < DAY) attn.push({ key: `pc${next.id}`, tone: "ok", icon: ICONS.video, title: `Call with ${who}`, sub: fmtDateTime(next.startTime), href: `/orders/${p.id}`, cta: "Open" });
  }

  return (
    <div className="page stack-lg" style={{ gap: 20, maxWidth: 1180 }}>
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="stack-sm">
          <h1 className="page-title">Hi{first ? `, ${first}` : ""}</h1>
          <p className="lede">Here&apos;s what needs you today.</p>
        </div>
        <span className="text-muted small">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
      </div>

      {progress && !progress.complete && (
        <>
          <section className="finish-banner" aria-label="Finish your profile">
            <div className="grow stack-sm" style={{ minWidth: 240 }}>
              <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                <b style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 22 }}>Finish your profile</b>
                <b style={{ color: "var(--primary-deep)" }}>{progress.done} of {progress.total}</b>
              </div>
              <div className="progress-track" role="progressbar" aria-label="Profile steps done" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
                <div style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              <span className="text-secondary small">Still to do: {missing.map((s) => s.label).join(" · ")}</span>
            </div>
            <Link href={missing[0]?.href || "/dashboard/profile"} className="btn btn-primary">Continue</Link>
          </section>
          <div className="hidden-note">
            <Icon d={ICONS.alert} size={16} />
            <span><b>Your profile is hidden from Browse until it&apos;s complete.</b> Students can&apos;t find you or buy from you yet.</span>
          </div>
        </>
      )}

      <div className="mentor-home-grid">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section className="mentor-box">
            <div className="mentor-box-head">
              <h2>Needs your attention</h2>
              {attn.length > 0 && <span className="text-muted small">{attn.length} {attn.length === 1 ? "thing" : "things"}</span>}
            </div>
            {attn.length === 0 ? (
              <span className="text-muted" style={{ padding: "8px 0" }}>You&apos;re all caught up.</span>
            ) : (
              attn.map((a) => (
                <div key={a.key} className="mentor-row">
                  <span className={`mentor-row-icon ${a.tone}`}><Icon d={a.icon} size={16} /></span>
                  <div className="grow stack-sm" style={{ gap: 0, minWidth: 0 }}>
                    <b style={{ fontSize: 15 }}>{a.title}</b>
                    {a.sub && <span className="text-muted small">{a.sub}</span>}
                  </div>
                  <Link href={a.href} className="btn btn-sm btn-soft">{a.cta}</Link>
                </div>
              ))
            )}
          </section>

          <section className="mentor-box">
            <div className="mentor-box-head">
              <h2>Active students &amp; packages</h2>
              <Link href="/dashboard/students" className="link small">{activePkgs.length ? `All ${activePkgs.length}` : "All packages"}</Link>
            </div>
            {packages === null && <span className="text-muted">Loading…</span>}
            {packages !== null && activePkgs.length === 0 && <span className="text-muted" style={{ padding: "8px 0" }}>No active packages right now.</span>}
            {activePkgs.slice(0, 5).map((p) => <PackageRow key={p.id} p={p} />)}
          </section>
        </div>

        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <section className="mentor-box">
            <div className="mentor-box-head">
              <h2>This week&apos;s calls</h2>
              <Link href="/dashboard/availability" className="link small">Calendar</Link>
            </div>
            <UpcomingCalls calls={calls} days={7} empty="No calls in the next 7 days." />
          </section>

          <section className="mentor-box" style={{ gap: 10 }}>
            <div className="mentor-box-head">
              <h2>Earnings</h2>
              <Link href="/dashboard/payouts" className="link small">Payouts</Link>
            </div>
            <div className="between">
              <span className="text-secondary">Earned this month (not yet paid)</span>
              <b style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: 26 }}>{earnings ? money(earnings.unpaidCents) : "…"}</b>
            </div>
            {earnings?.heldCents > 0 && <span className="text-muted small">+ {money(earnings.heldCents)} held by a dispute</span>}
            <div className="between" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <span className="text-secondary">Next payout</span>
              <span>
                <b>{earnings ? money(earnings.unpaidCents) : "…"}</b>
                <span className="text-muted"> on {earnings ? payoutDayLabel(earnings.nextPayoutDay) : "the 24th"}</span>
              </span>
            </div>
            {earnings && !earnings.payoutsConnected && <span className="text-muted small">Connect payouts to be paid.</span>}
            <span className="text-muted small">
              {profile?.hourlyRateCents ? `Your rate: ${money(profile.hourlyRateCents)}/hr · ` : ""}
              <Link href="/dashboard/packages" className="link">Rates &amp; packages</Link>
            </span>
            <span className="text-muted small">You earn {100 - PLATFORM_FEE_PERCENT}% of each hour, paid on the 24th of each month.</span>
          </section>

          {profile && <PreviewProfileButton mentorId={profile.id} className="btn btn-sm" />}
        </div>
      </div>
    </div>
  );
}
