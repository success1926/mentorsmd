"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDENT_NAV, isStudentNavActive, type StudentNavKey } from "@/lib/studentNav";
import { onLive } from "@/lib/realtimeClient";
import { money } from "@/lib/options";

// Student area layout (student area v2, Oct 2026): a sidebar on the left on
// every student page (a Menu button on phones that opens it as a drawer),
// the page on the right. The same layout and styles as the mentor area
// (components/MentorShell.tsx). The links are in lib/studentNav.ts; the
// badges come from /api/me/nav, refreshed on every page change, every
// minute, when a message arrives and after a package changes (the
// "mmd:packages-changed" event, see notifyPackagesChanged).

export type StudentStatus = {
  name: string;
  photoUrl: string | null;
  activePackages: number;
  waiting: number;
  upcomingCalls: number;
  creditCents: number;
};

// Call after anything that changes the sidebar's numbers (approving a
// package, booking or cancelling a call).
export function notifyPackagesChanged() {
  window.dispatchEvent(new Event("mmd:packages-changed"));
}

export function useStudentStatus() {
  const pathname = usePathname();
  const [data, setData] = useState<{ unread: number; student: StudentStatus | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/me/nav")
        .then((r) => r.json())
        .then((d) => alive && setData({ unread: d.unread || 0, student: d.student || null }))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener("focus", load);
    window.addEventListener("mmd:unread-changed", load);
    window.addEventListener("mmd:packages-changed", load);
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
      window.removeEventListener("mmd:packages-changed", load);
    };
  }, [pathname]);
  return data;
}

const NAV_ICONS: Record<StudentNavKey, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  packages: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </>
  ),
  messages: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  mentors: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  credit: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11" />
    </>
  ),
  receipts: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
};

function NavIcon({ k }: { k: StudentNavKey }) {
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

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const data = useStudentStatus();
  const student = data?.student ?? null;
  const current = STUDENT_NAV.find((n) => isStudentNavActive(pathname, n));

  const badge = (key: StudentNavKey) => {
    if (key === "packages" && student && student.activePackages > 0) {
      return <span className="mentor-nav-count" aria-label={`${student.activePackages} active`}>{student.activePackages}</span>;
    }
    if (key === "messages" && data && data.unread > 0) {
      return <span className="count-badge" aria-label={`${data.unread} unread`}>{data.unread > 99 ? "99+" : data.unread}</span>;
    }
    if (key === "calendar" && student && student.upcomingCalls > 0) {
      return <span className="mentor-nav-count" aria-label={`${student.upcomingCalls} upcoming`}>{student.upcomingCalls}</span>;
    }
    if (key === "credit" && student && student.creditCents > 0) {
      return <span className="mentor-nav-pill ok">{money(student.creditCents)}</span>;
    }
    if (key === "mentors") {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--faint)" }}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="mentor-shell">
      <nav className={`mentor-side${open ? " is-open" : ""}`} aria-label="Student area">
        <div className="mentor-side-top">
          <span className="mentor-side-avatar" aria-hidden="true">
            {student?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photoUrl} alt="" />
            ) : (
              initialsOf(student?.name || "")
            )}
          </span>
          <span className="mentor-side-who">
            <b>{student?.name || " "}</b>
            <span>Student</span>
          </span>
          <span className="mentor-side-current">{current?.label}</span>
          <button type="button" className="btn btn-sm mentor-menu-btn" aria-expanded={open} aria-controls="student-nav-list" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div id="student-nav-list" className="mentor-nav-list">
          {STUDENT_NAV.map((n) => (
            <Link key={n.key} href={n.href} className="mentor-link" aria-current={isStudentNavActive(pathname, n) ? "page" : undefined}>
              <NavIcon k={n.key} />
              <span className="grow">{n.label}</span>
              {badge(n.key)}
            </Link>
          ))}
          <div className="mentor-status-card">
            <b>Not sure who to pick?</b>
            <span className="text-secondary">Book a free 15-minute intro call with any mentor first.</span>
            <Link href="/mentors" className="link">Browse mentors</Link>
          </div>
          <Link href="/contact" className="mentor-link mentor-link-quiet">Contact us</Link>
        </div>
      </nav>
      <main className="mentor-main">{children}</main>
    </div>
  );
}
