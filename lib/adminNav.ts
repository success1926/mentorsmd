import { can, type PermissionCheck } from "@/lib/adminPermissions";

// The admin sidebar, in groups. Adding a page is one line here. Each
// person only sees the items their role allows (and a group only if it
// has any). `ready: false` hides an item whose page hasn't shipped yet.
// `hideIfCan` hides an item for people who can open a page that replaces
// it (Mentor applications live inside Leads for anyone with "leads").
// `badge` is a count shown next to the label (filled in by the layout).
export type AdminNavItem = { href: string; label: string; perm: PermissionCheck; group: string; ready?: boolean; exact?: boolean; hideIfCan?: PermissionCheck; badge?: number };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", perm: "overview", group: "General", exact: true },

  { href: "/admin/mentors", label: "Mentors", perm: "mentors", group: "Marketplace" },
  { href: "/admin/leads", label: "Leads", perm: "leads", group: "Marketplace" },
  { href: "/admin/applications", label: "Mentor applications", perm: "applications", group: "Marketplace", hideIfCan: "leads" },
  { href: "/admin/people", label: "People", perm: "people", group: "Marketplace" },
  { href: "/admin/orders", label: "Orders & payouts", perm: "orders", group: "Marketplace" },
  { href: "/admin/services", label: "Services", perm: "services", group: "Marketplace" },

  { href: "/admin/disputes", label: "Disputes & flags", perm: ["disputes", "flags"], group: "Safety" },
  { href: "/admin/calls", label: "Calls & recordings", perm: "calls", group: "Safety" },
  { href: "/admin/minors", label: "Under 18", perm: "minors", group: "Safety" },

  { href: "/admin/website", label: "Website", perm: "website", group: "Content & legal" },
  { href: "/admin/emails", label: "Emails", perm: "emails", group: "Content & legal" },
  { href: "/admin/email-log", label: "Email log", perm: "emails", group: "Content & legal" },
  { href: "/admin/legal", label: "Legal", perm: "legal", group: "Content & legal" },

  { href: "/admin/insights", label: "Insights", perm: "insights", group: "Settings" },
  { href: "/admin/action-log", label: "Action log", perm: "actionlog", group: "Settings" },
  { href: "/admin/team", label: "Team & roles", perm: "team", group: "Settings" },
];

export function visibleAdminNav(user: { perms: readonly string[] }) {
  return ADMIN_NAV.filter((n) => n.ready !== false && can(user, n.perm) && !(n.hideIfCan && can(user, n.hideIfCan)));
}

// Where to send someone whose role can't see the Overview.
export function firstAdminPage(user: { perms: readonly string[] }) {
  return visibleAdminNav(user)[0]?.href ?? null;
}
