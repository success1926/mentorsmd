"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Icon, ICONS, LoadingBlock, PageHeader } from "@/components/ui";
import { fmtDateTime, firstName, money } from "@/lib/format";
import { showLowHours } from "@/components/Packages";
import { PackageRow } from "@/components/PackageRow";
import { UpcomingCalls } from "@/components/UpcomingCalls";
import { PreviewProfileButton } from "@/components/MentorShell";
import { OfferGuideButton } from "@/components/OfferGuide";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { payoutDayLabel } from "@/lib/payoutRules";
import { StudentDashboard } from "./StudentDashboard";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  if (status === "loading") return <div className="page"><LoadingBlock lines={3} cards={2} /></div>;
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
  const first = firstName(session?.user?.name);
  // Everything on this page comes from one request (/api/dashboard/summary).
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (role !== "SELLER") return;
    fetch("/api/dashboard/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d || { failed: true }))
      .catch(() => setData({ failed: true }));
  }, [role]);

  if (status === "loading") return <div className="page"><LoadingBlock lines={3} cards={2} /></div>;
  if (role !== "SELLER") {
    return (
      <div className="page-narrow">
        <div className="alert">The dashboard is for mentor and student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }

  const now = Date.now();
  const profile = data?.profile;
  const earnings = data?.earnings;
  const packages: any[] | null = data ? data.packages || [] : null;
  const calls: any[] | null = data ? data.upcoming || [] : null;
  const activePkgs = (packages || []).filter((p) => ["WORKING", "AWAITING_STUDENT", "DISPUTED"].includes(finishPhase(p)));
  const progress = profile?.progress as { sections: any[]; done: number; total: number; complete: boolean } | undefined;
  const missing = (progress?.sections || []).filter((s) => !s.done);

  const attn: Attn[] = [];
  if (data?.payouts && !data.payouts.connected) attn.push({ key: "payouts", tone: "danger", icon: ICONS.lock, title: "Connect payouts", sub: "Students can't buy from you until your bank account is connected.", href: "/dashboard/payouts", cta: "Connect" });
  if (profile?.hourlyRateCents && data?.offers && !data.offers.hasExtras) attn.push({ key: "gigs", tone: "", icon: ICONS.pen, title: "Add hour bundles or a specialized package", sub: "Optional, but students like choices.", href: "/dashboard/packages", cta: "Add offers" });
  if (profile && !profile.hasAvailability && data?.offers?.hasCallOffer) attn.push({ key: "cal", tone: "warn", icon: ICONS.calendar, title: "Set your call hours", sub: "So students can book the calls in your packages.", href: "/dashboard/availability#call-hours", cta: "Set hours" });
  // Students waiting on a reply (the last message in the thread is theirs).
  for (const c of data?.waiting || []) {
    const hours = Math.max(1, Math.round((now - new Date(c.lastAt).getTime()) / 3600_000));
    attn.push({ key: `m${c.conversationId}`, tone: "danger", icon: ICONS.chat, title: `Reply to ${firstName(c.studentName) || "your student"}`, sub: `Waiting ${hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`}`, href: `/messages/${c.conversationId}`, cta: "Reply" });
  }
  for (const p of activePkgs) {
    const who = firstName(p.buyer?.name) || "Student";
    if (p.disputed) attn.push({ key: `pd${p.id}`, tone: "danger", icon: ICONS.flag, title: `${who} opened a dispute`, sub: p.title, href: `/orders/${p.id}`, cta: "View" });
    else if (finishPhase(p) === "WORKING" && p.lastRequestNote && (p.lastCallUsedAt || p.lastRevisionUsedAt)) attn.push({ key: `pl${p.id}`, tone: "warn", icon: ICONS.cycle, title: `${who} asked for ${p.lastCallUsedAt ? "one last call" : "one last revision"}`, sub: p.title, href: `/orders/${p.id}`, cta: "Open" });
    else if (showLowHours(p)) attn.push({ key: `pw${p.id}`, tone: "warn", icon: ICONS.clock, title: `${who} has ${shortHours(hoursSummary(p).left)} left`, sub: `Suggest a top-up or a final call · ${p.title}`, href: `/orders/${p.id}`, cta: "Open package" });
    const next = hoursSummary(p).upcoming[0];
    if (next && new Date(next.startTime).getTime() - now < DAY) attn.push({ key: `pc${next.id}`, tone: "ok", icon: ICONS.video, title: `Call with ${who}`, sub: fmtDateTime(next.startTime), href: `/orders/${p.id}`, cta: "Open" });
  }

  return (
    <div className="page stack-lg" style={{ gap: 20 }}>
      <PageHeader
        title={`Hi${first ? `, ${first}` : ""}`}
        lede="Here's what needs you today."
        actions={<span className="text-muted small">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>}
      />
      {data?.failed && <div className="alert alert-danger">Couldn&apos;t load your home page. Refresh to try again.</div>}

      {progress && !progress.complete && (
        <>
          <section className="finish-banner" aria-label="Finish your profile">
            <div className="grow stack-sm" style={{ minWidth: 240 }}>
              <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                <b className="block-title">Finish your profile</b>
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
            {data === null ? (
              <LoadingBlock title={false} lines={2} />
            ) : attn.length === 0 ? (
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
            {packages === null && <LoadingBlock title={false} lines={2} />}
            {packages !== null && activePkgs.length === 0 && <span className="text-muted" style={{ padding: "8px 0" }}>No active packages right now.</span>}
            {activePkgs.slice(0, 5).map((p) => <PackageRow key={p.id} p={p} audience="mentor" />)}
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
              <b className="block-title">{earnings ? money(earnings.unpaidCents) : "…"}</b>
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
              {" · "}
              <OfferGuideButton rateCents={profile?.hourlyRateCents} className="btn-link">Offer guide</OfferGuideButton>
            </span>
            <span className="text-muted small">You earn {100 - PLATFORM_FEE_PERCENT}% of each hour, paid on the 24th of each month.</span>
          </section>

          {profile && <PreviewProfileButton mentorId={profile.id} className="btn btn-sm" />}
        </div>
      </div>
    </div>
  );
}
