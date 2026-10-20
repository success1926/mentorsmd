"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";
import { MENTOR_NAV, isMentorNavActive, previewHref, type MentorNavKey } from "@/lib/mentorNav";
import { onLive } from "@/lib/realtimeClient";

// Mentor area layout (mentor area v2, Oct 2026): a sidebar on the left on
// every mentor page (a Menu button on phones that opens it as a drawer),
// the page on the right. Like the admin area's AdminShell. The links are in
// lib/mentorNav.ts; the badges and the "Hidden from Browse / Live on
// Browse" card come from /api/me/nav, refreshed on every page change,
// every minute, when a message arrives and right after the profile is
// saved (the "mmd:profile-changed" event, see notifyProfileChanged).

export type MentorStatus = {
  id: string;
  name: string;
  photoUrl: string | null;
  activePackages: number;
  progress: { done: number; total: number; complete: boolean; missing: string[] };
  listed: boolean;
  paused: boolean;
  removed: boolean;
  safetyHold: boolean;
  payoutsStarted: boolean;
};

// Call after saving anything that changes the profile checklist.
export function notifyProfileChanged() {
  window.dispatchEvent(new Event("mmd:profile-changed"));
}

// The sidebar's data, for pages that want the same numbers.
export function useMentorStatus() {
  const pathname = usePathname();
  const [data, setData] = useState<{ unread: number; mentor: MentorStatus | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/me/nav")
        .then((r) => r.json())
        .then((d) => alive && setData({ unread: d.unread || 0, mentor: d.mentor || null }))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    window.addEventListener("mmd:unread-changed", load);
    window.addEventListener("mmd:profile-changed", load);
    let liveTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onLive((event) => {
      if (event !== "message") return;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(load, 1500);
    });
    return () => {
      alive = false;
      off();
      clearTimeout(liveTimer);
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("mmd:unread-changed", load);
      window.removeEventListener("mmd:profile-changed", load);
    };
  }, [pathname]);
  return data;
}

const NAV_ICONS: Record<MentorNavKey, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  students: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
    </>
  ),
  messages: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4.5 4.2-7 8-7s7 2.5 8 7" />
    </>
  ),
  rates: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  payouts: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

function NavIcon({ k }: { k: MentorNavKey }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {NAV_ICONS[k]}
    </svg>
  );
}

const initialsOf = (name: string) =>
  (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// "Hidden from Browse" / "Live on Browse" / "Paused", with a preview link.
export function BrowseStatusCard({ mentor }: { mentor: MentorStatus }) {
  const [tone, title, text] = mentor.removed
    ? ["danger", "Profile removed", "Restore it in Settings."]
    : mentor.safetyHold
      ? ["warn", "Hidden from Browse", "Paused by MentorsMD for a safety review."]
      : !mentor.progress.complete
        ? ["warn", "Hidden from Browse", "Finish your profile to go live."]
        : mentor.paused
          ? ["warn", "Paused", "Hidden from Browse until you're back."]
          : !mentor.listed
            ? ["warn", "Hidden from Browse", "Save any step of My profile to go live."]
            : !mentor.payoutsStarted
              ? ["warn", "Live on Browse", "Students can find you. Set up payouts so they can buy."]
              : ["ok", "Live on Browse", "Students can find and book you."];
  return (
    <div className="mentor-status-card">
      <span className="row" style={{ gap: 8 }}>
        <span className={`mentor-status-dot ${tone}`} aria-hidden="true" />
        <b>{title}</b>
      </span>
      <span className="text-secondary">{text}</span>
      <Link href={previewHref(mentor.id)} className="link">Preview my profile</Link>
    </div>
  );
}

export function MentorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const data = useMentorStatus();
  const mentor = data?.mentor ?? null;
  const current = MENTOR_NAV.find((n) => isMentorNavActive(pathname, n));

  const badge = (key: MentorNavKey) => {
    if (key === "students" && mentor && mentor.activePackages > 0) {
      return <span className="mentor-nav-count" aria-label={`${mentor.activePackages} active`}>{mentor.activePackages}</span>;
    }
    if (key === "messages" && data && data.unread > 0) {
      return <span className="count-badge" aria-label={`${data.unread} unread`}>{data.unread > 99 ? "99+" : data.unread}</span>;
    }
    if (key === "profile" && mentor && !mentor.progress.complete) {
      return <span className="mentor-nav-pill">{mentor.progress.done} of {mentor.progress.total}</span>;
    }
    return null;
  };

  return (
    <div className="mentor-shell">
      <nav className={`mentor-side${open ? " is-open" : ""}`} aria-label="Mentor area">
        <div className="mentor-side-top">
          <span className="mentor-side-avatar" aria-hidden="true">
            {mentor?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mentor.photoUrl} alt="" />
            ) : (
              initialsOf(mentor?.name || "")
            )}
          </span>
          <span className="mentor-side-who">
            <b>{mentor?.name || " "}</b>
            <span>Mentor workspace</span>
          </span>
          <span className="mentor-side-current">{current?.label}</span>
          <button type="button" className="btn btn-sm mentor-menu-btn" aria-expanded={open} aria-controls="mentor-nav-list" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div id="mentor-nav-list" className="mentor-nav-list">
          {MENTOR_NAV.map((n) => (
            <Link key={n.key} href={n.href} className="mentor-link" aria-current={isMentorNavActive(pathname, n) ? "page" : undefined}>
              <NavIcon k={n.key} />
              <span className="grow">{n.label}</span>
              {badge(n.key)}
            </Link>
          ))}
          {mentor && <BrowseStatusCard mentor={mentor} />}
          <Link href="/contact" className="mentor-link mentor-link-quiet">Contact us</Link>
        </div>
      </nav>
      <main className="mentor-main">{children}</main>
    </div>
  );
}

// Small "Preview my profile" button used on several mentor pages.
export function PreviewProfileButton({ mentorId, className = "btn btn-sm", label = "Preview my profile" }: { mentorId: string | undefined; className?: string; label?: string }) {
  if (!mentorId) return null;
  return (
    <Link href={previewHref(mentorId)} className={className}>
      <Icon d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z" size={16} /> {label}
    </Link>
  );
}
