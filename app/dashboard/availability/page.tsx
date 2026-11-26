"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BusyDatesCard, CallHoursCard, ExternalCalendarCard } from "@/components/AvailabilitySettings";
import { CalendarSync } from "@/components/CalendarSync";
import { UpcomingCalls } from "@/components/UpcomingCalls";
import { SettingsSection } from "@/components/SettingsSection";
import { Alert, Collapsible, LoadingBlock, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

// Calendar & availability (mentor area v2, Oct 2026): everything about time
// in one place. Call hours (with the mentor's one time zone, also used for
// reminders and email times), minimum notice, break between calls, days
// off, busy dates, connected calendars (blocking times from their own
// calendar, and syncing MentorsMD calls to it), upcoming calls and past
// calls. These used to be on /account (old links like /account#call-hours
// come here), and /calendar sends mentors here too.

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [profile, setProfile] = useState<any>(null);
  const [calls, setCalls] = useState<{ upcoming: any[]; past: any[] } | null>(null);
  const [error, setError] = useState("");

  function loadProfile() {
    return fetch("/api/profile")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.profile) setError(d.error || "Couldn't load your availability. Refresh the page to try again.");
        else {
          setError("");
          setProfile(d.profile);
        }
      })
      .catch(() => setError("Couldn't load your availability. Refresh the page to try again."));
  }

  useEffect(() => {
    if (role !== "SELLER") return;
    loadProfile();
    fetch("/api/me/calendar")
      .then((r) => r.json())
      .then((d) => setCalls({ upcoming: d.upcoming || [], past: d.past || [] }))
      .catch(() => setCalls({ upcoming: [], past: [] }));
  }, [role]);

  // Jump to #call-hours / #busy-dates / #calendar once the page has content.
  useEffect(() => {
    if (profile && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session && role !== "SELLER") return <div className="page-mid"><div className="alert">This page is for mentor accounts. <Link href="/account" className="link">Your account</Link></div></div>;
  if (!profile && error) return <div className="page-mid"><Alert tone="danger">{error}</Alert></div>;
  if (!profile) return <div className="page-mid"><LoadingBlock lines={3} cards={3} /></div>;
  const past = calls?.past || [];

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <PageHeader title="Calendar &amp; availability" lede="When students can book calls, and the dates you're busy. Everything about time lives here." />

      <CallHoursCard key={JSON.stringify([profile.weeklyHours, profile.timeZone, profile.daysOff])} profile={profile} onSaved={loadProfile} />

      <section className="mentor-box">
        <div className="mentor-box-head">
          <h2>Upcoming calls</h2>
          <span className="text-muted small">Next 14 days</span>
        </div>
        <UpcomingCalls calls={calls ? calls.upcoming : null} empty="No calls in the next 14 days." />
      </section>

      {past.length > 0 && (
        <Collapsible id="past-calls" title="Past calls" count={past.length} bodyClassName="past-calls">
          {past.map((c: any) => (
            <Link key={c.id} href={c.orderId ? `/orders/${c.orderId}` : `/calls/${c.id}`} className="list-row">
              <span className="grow stack-sm" style={{ gap: 0 }}>
                <b>{c.kind === "INTRO" ? "Intro call" : "Call"} with {c.withName}</b>
                <span className="text-muted small">{fmtDateTime(c.startTime)} · {c.title}</span>
              </span>
            </Link>
          ))}
        </Collapsible>
      )}

      <BusyDatesCard />

      <SettingsSection
        id="calendar"
        title="Connected calendars"
        description="Block times you're busy in your own calendar, and add your MentorsMD calls to it."
      >
        <ExternalCalendarCard profile={profile} onChanged={loadProfile} />
        <div id="calendar-sync" className="connected-cal-sync">
          <CalendarSync isMentor />
        </div>
      </SettingsSection>
    </div>
  );
}
