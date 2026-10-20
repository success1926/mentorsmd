// The student area's sidebar (components/StudentShell.tsx) and the student
// links in the top bar's menu (components/TopNav.tsx), in one place.
// Student area v2 (Oct 2026), the same pattern as lib/mentorNav.ts.
// Pure data, safe to import from both server and client code.

export type StudentNavKey = "home" | "packages" | "messages" | "calendar" | "mentors" | "credit" | "receipts" | "profile" | "settings";

export type StudentNavItem = {
  key: StudentNavKey;
  label: string;
  href: string;
  // Other pages that count as "in" this item (the sidebar highlights it).
  also?: string[];
  exact?: boolean;
};

export const STUDENT_NAV: StudentNavItem[] = [
  { key: "home", label: "Home", href: "/dashboard", exact: true },
  { key: "packages", label: "My packages", href: "/orders" },
  { key: "messages", label: "Messages", href: "/messages" },
  { key: "calendar", label: "Calendar", href: "/calendar", also: ["/calls"] },
  { key: "mentors", label: "Find a mentor", href: "/mentors" },
  { key: "credit", label: "MentorsMD credit", href: "/credit" },
  { key: "receipts", label: "Receipts", href: "/receipts" },
  { key: "profile", label: "About you", href: "/about-you" },
  { key: "settings", label: "Settings", href: "/account" },
];

export function isStudentNavActive(pathname: string, n: StudentNavItem) {
  if (n.exact) return pathname === n.href;
  return [n.href, ...(n.also ?? [])].some((h) => pathname === h || pathname.startsWith(h + "/"));
}

// Old /account#anchor links for students: calendar sync moved to Calendar.
export function studentAccountRedirect(hash: string): string | null {
  const anchor = hash.replace(/^#/, "");
  if (anchor === "calendar" || anchor === "calendar-sync") return "/calendar#calendar-sync";
  return null;
}
