// The mentor area's sidebar (components/MentorShell.tsx) and the mentor
// links in the top bar's menu (components/TopNav.tsx), in one place.
// Pure data, safe to import from both server and client code.

export type MentorNavKey = "home" | "students" | "messages" | "calendar" | "profile" | "rates" | "payouts" | "settings";

export type MentorNavItem = {
  key: MentorNavKey;
  label: string;
  href: string;
  // Other pages that count as "in" this item (the sidebar highlights it).
  also?: string[];
  exact?: boolean;
};

export const MENTOR_NAV: MentorNavItem[] = [
  { key: "home", label: "Home", href: "/dashboard", exact: true },
  { key: "students", label: "Students & packages", href: "/dashboard/students", also: ["/orders"] },
  { key: "messages", label: "Messages", href: "/messages" },
  { key: "calendar", label: "Calendar & availability", href: "/dashboard/availability", also: ["/calendar"] },
  { key: "profile", label: "My profile", href: "/dashboard/profile" },
  { key: "rates", label: "Rates & packages", href: "/dashboard/packages" },
  { key: "payouts", label: "Payouts", href: "/dashboard/payouts" },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
];

export function isMentorNavActive(pathname: string, n: MentorNavItem) {
  if (n.exact) return pathname === n.href;
  return [n.href, ...(n.also ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
}

// The mentor's public profile, as students see it (with the preview banner).
export const previewHref = (mentorId: string) => `/mentors/${mentorId}?preview=1`;

// Old /account#anchor links (emails, bookmarks) -> the page that now holds
// that section, for mentors. Anything else goes to Settings.
const ACCOUNT_ANCHORS: Record<string, string> = {
  profile: "/dashboard/profile#basics",
  search: "/dashboard/profile#basics",
  basics: "/dashboard/profile#basics",
  bio: "/dashboard/profile#bio",
  admissions: "/dashboard/profile#admissions",
  clinical: "/dashboard/profile#clinical",
  "best-for": "/dashboard/profile#best-for",
  highlights: "/dashboard/profile#highlights",
  "known-for": "/dashboard/profile#known-for",
  languages: "/dashboard/profile#languages",
  "fun-fact": "/dashboard/profile#fun-fact",
  "call-hours": "/dashboard/availability#call-hours",
  "time-zone": "/dashboard/availability#call-hours",
  "busy-dates": "/dashboard/availability#busy-dates",
  calendar: "/dashboard/availability#calendar",
  availability: "/dashboard/settings#pause",
  pause: "/dashboard/settings#pause",
  remove: "/dashboard/settings#remove",
  minors: "/dashboard/settings#minors",
};

export function mentorAccountRedirect(hash: string, search = "") {
  const anchor = hash.replace(/^#/, "");
  const target = ACCOUNT_ANCHORS[anchor] || "/dashboard/settings";
  // Google Calendar's ?gcal= result belongs with the calendar settings.
  const qs = new URLSearchParams(search);
  if (qs.get("gcal")) return `/dashboard/availability?gcal=${encodeURIComponent(qs.get("gcal")!)}#calendar`;
  return target;
}
