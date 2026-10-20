"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initialsOf } from "@/components/ui";

// The layout of the mentor and student areas (mentor area v2 / student area
// v2, Oct 2026): a sidebar on the left (a Menu button on phones that opens
// it as a drawer) and the page on the right. MentorShell and StudentShell
// pass their own links (lib/mentorNav.ts, lib/studentNav.ts), badges and
// the card under the links.

export type AreaNavItem = { key: string; href: string; label: string };

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  students: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
    </>
  ),
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

function NavIcon({ k }: { k: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[k]}
    </svg>
  );
}

// Small badges used by both areas.
export function CountBadge({ n, label }: { n: number; label: string }) {
  return <span className="mentor-nav-count" aria-label={`${n} ${label}`}>{n}</span>;
}
export function UnreadBadge({ n }: { n: number }) {
  return <span className="count-badge" aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span>;
}

export function AreaShell<T extends AreaNavItem>({
  id,
  label,
  role,
  person,
  nav,
  isActive,
  badge,
  card,
  children,
}: {
  id: string; // "mentor" | "student": used for the list's id
  label: string; // the nav's accessible name, e.g. "Mentor area"
  role: string; // under the name, e.g. "Mentor workspace"
  person: { name: string; photoUrl: string | null } | null;
  nav: readonly T[];
  isActive: (pathname: string, item: T) => boolean;
  badge: (item: T) => React.ReactNode;
  card?: React.ReactNode; // under the links
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/dashboard";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const current = nav.find((n) => isActive(pathname, n));
  const listId = `${id}-nav-list`;

  return (
    <div className="mentor-shell">
      <nav className={`mentor-side${open ? " is-open" : ""}`} aria-label={label}>
        <div className="mentor-side-top">
          <span className="mentor-side-avatar" aria-hidden="true">
            {person?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.photoUrl} alt="" />
            ) : (
              initialsOf(person?.name || "")
            )}
          </span>
          <span className="mentor-side-who">
            <b>{person?.name || " "}</b>
            <span>{role}</span>
          </span>
          <span className="mentor-side-current">{current?.label}</span>
          <button type="button" className="btn btn-sm mentor-menu-btn" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        </div>
        <div id={listId} className="mentor-nav-list">
          {nav.map((n) => (
            <Link key={n.key} href={n.href} className="mentor-link" aria-current={isActive(pathname, n) ? "page" : undefined}>
              <NavIcon k={n.key} />
              <span className="grow">{n.label}</span>
              {badge(n)}
            </Link>
          ))}
          {card}
          <Link href="/contact" className="mentor-link mentor-link-quiet">Contact us</Link>
        </div>
      </nav>
      <main className="mentor-main">{children}</main>
    </div>
  );
}
