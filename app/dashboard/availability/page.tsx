"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BusyDatesCard, CallHoursCard, ExternalCalendarCard } from "@/components/AvailabilitySettings";
import { CalendarSync } from "@/components/CalendarSync";
import { UpcomingCalls } from "@/components/UpcomingCalls";

// Calendar & availability (mentor area v2, Oct 2026): everything about time
// in one place. Call hours (with the mentor's one time zone, also used for
// reminders and email times), minimum notice, break between calls, days
// off, busy dates, blocking times from their own calendar, upcoming calls
// and syncing MentorsMD calls to their calendar. These used to be on
// /account (old links like /account#call-hours come here).

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [profile, setProfile] = useState<any>(null);
  const [calls, setCalls] = useState<any[] | null>(null);

  function loadProfile() {
    return fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d.profile || null)).catch(() => {});
  }

  useEffect(() => {
    if (role !== "SELLER") return;
    loadProfile();
    fetch("/api/me/calendar").then((r) => r.json()).then((d) => setCalls(d.upcoming || [])).catch(() => setCalls([]));
  }, [role]);

  // Jump to #call-hours / #busy-dates / #calendar once the page has content.
  useEffect(() => {
    if (profile && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && role !== "SELLER") return <div className="page-narrow"><div className="alert">This page is for mentor accounts. <Link href="/account" className="link">Your account</Link></div></div>;
  if (!profile) return <div className="page-mid text-muted">Loading…</div>;

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div className="stack-sm">
          <h1 className="page-title">Calendar &amp; availability</h1>
          <p className="lede">When students can book calls, and the dates you&apos;re busy. Everything about time lives here.</p>
        </div>
        <Link href="/calendar" className="btn btn-sm">Month view</Link>
      </div>

      <CallHoursCard key={JSON.stringify([profile.weeklyHours, profile.timeZone, profile.daysOff])} profile={profile} onSaved={loadProfile} />

      <section id="calendar" style={{ scrollMarginTop: 100 }}>
        <ExternalCalendarCard profile={profile} onChanged={loadProfile} />
      </section>

      <section className="mentor-box">
        <div className="mentor-box-head">
          <h2>Upcoming calls</h2>
          <span className="text-muted small">Next 14 days</span>
        </div>
        <UpcomingCalls calls={calls} empty="No calls in the next 14 days." />
      </section>

      <BusyDatesCard />

      <section id="calendar-sync" className="card stack" style={{ scrollMarginTop: 100 }}>
        <CalendarSync isMentor />
      </section>
    </div>
  );
}
