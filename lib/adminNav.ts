import { can, type PermissionCheck } from "@/lib/adminPermissions";

// The admin sidebar, in groups. Adding a page is one line here. Each
// person only sees the items their role allows (and a group only if it
// has any). `ready: false` hides an item whose page hasn't shipped yet.
export type AdminNavItem = { href: string; label: string; perm: PermissionCheck; group: string; ready?: boolean; exact?: boolean };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", perm: "overview", group: "General", exact: true },

  { href: "/admin/mentors", label: "Mentors", perm: "mentors", group: "Marketplace" },
  { href: "/admin/applications", label: "Mentor applications", perm: "applications", group: "Marketplace" },
  { href: "/admin/leads", label: "Leads", perm: "leads", group: "Marketplace", ready: false },
  { href: "/admin/people", label: "People", perm: "people", group: "Marketplace" },
  { href: "/admin/orders", label: "Orders & payouts", perm: "orders", group: "Marketplace" },
  { href: "/admin/services", label: "Services", perm: "services", group: "Marketplace" },

  { href: "/admin/disputes", label: "Disputes & flags", perm: ["disputes", "flags"], group: "Safety" },
  { href: "/admin/calls", label: "Calls & recordings", perm: "calls", group: "Safety" },
  { href: "/admin/minors", label: "Under 18", perm: "minors", group: "Safety" },

  // Website and Emails ship in their own pull requests; flip `ready` to
  // true (or drop it) once their pages are merged.
  { href: "/admin/website", label: "Website", perm: "website", group: "Content & legal", ready: false },
  { href: "/admin/emails", label: "Emails", perm: "emails", group: "Content & legal", ready: false },
  { href: "/admin/email-log", label: "Email log", perm: "emails", group: "Content & legal", ready: false },
  { href: "/admin/legal", label: "Legal", perm: "legal", group: "Content & legal" },

  { href: "/admin/insights", label: "Insights", perm: "insights", group: "Settings" },
  { href: "/admin/action-log", label: "Action log", perm: "actionlog", group: "Settings" },
  { href: "/admin/team", label: "Team & roles", perm: "team", group: "Settings" },
];

export function visibleAdminNav(user: { perms: readonly string[] }) {
  return ADMIN_NAV.filter((n) => n.ready !== false && can(user, n.perm));
}

// Where to send someone whose role can't see the Overview.
export function firstAdminPage(user: { perms: readonly string[] }) {
  return visibleAdminNav(user)[0]?.href ?? null;
}
