"use client";

import { useEffect, useState } from "react";

// "Sync to your calendar": a private calendar link (ICS feed) with the
// person's booked calls (and, for mentors, order due dates), plus one-click
// buttons for Google, Outlook and Apple. Used on /account (students) and
// Calendar & availability (mentors).

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <span className="field-label">{label}</span>
      <div className="row">
        <input className="input grow" style={{ marginBottom: 0, fontFamily: "ui-monospace, monospace", fontSize: 13 }} readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function CalendarSync({ isMentor }: { isMentor: boolean }) {
  const [feedUrl, setFeedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/calendar").then((r) => r.json()).then((d) => setFeedUrl(d.feedUrl)).catch(() => {});
  }, []);

  async function calendarFeed(method: "POST" | "DELETE") {
    if (method === "POST" && feedUrl && !confirm("Reset your calendar link? The old link stops working and you'll need to add the new one to your calendar.")) return;
    const res = await fetch("/api/profile/calendar", { method });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setFeedUrl(d.feedUrl);
  }

  const webcal = feedUrl ? feedUrl.replace(/^https?:/, "webcal:") : "";

  return (
    <div className="stack">
      <b>Sync to your calendar</b>
      <span className="text-secondary small">
        Your booked calls appear in your calendar and update on their own. This link is private, so don&apos;t share it.
      </span>
      {feedUrl ? (
        <>
          <div className="row-wrap">
            <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}>Add to Google Calendar</a>
            <a className="btn btn-sm" target="_blank" rel="noopener noreferrer" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=MentorsMD`}>Add to Outlook</a>
            <a className="btn btn-sm" href={webcal}>Add to Apple Calendar</a>
          </div>
          <CopyField label="Or copy the calendar link" value={feedUrl} />
          <div className="row-wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => calendarFeed("POST")}>Reset link</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => calendarFeed("DELETE")}>Disconnect</button>
          </div>
        </>
      ) : (
        <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => calendarFeed("POST")}>Connect my calendar</button>
      )}
    </div>
  );
}
