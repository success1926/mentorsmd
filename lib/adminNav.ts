import { can, type AdminPermission, type PermissionCheck } from "@/lib/adminPermissions";

// The admin sidebar, in groups. Adding a page is one line here. Each
// person only sees the items their role allows (and a group only if it
// has any). `ready: false` hides an item whose page hasn't shipped yet.
// `hideIfCan` hides an item for people who can open a page that replaces
// it (Mentor applications live inside Leads for anyone with "leads").
// `badge` is a count shown next to the label (filled in by the layout).
// `also` lists other pages that count as this item (tabs of the same
// page, e.g. the Email log under Emails), so it stays highlighted there.
// `otherwise` is where the item goes for a role without `unless` (Everyone
// opens Mentor invites for someone who can't see People).
export type AdminNavItem = {
  href: string;
  label: string;
  perm: PermissionCheck;
  group: string;
  ready?: boolean;
  exact?: boolean;
  hideIfCan?: PermissionCheck;
  badge?: number;
  also?: string[];
  otherwise?: { unless: AdminPermission; href: string };
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", perm: "overview", group: "Home", exact: true },

  { href: "/admin/leads", label: "Leads", perm: "leads", group: "Inbox" },
  { href: "/admin/applications", label: "Mentor applications", perm: "applications", group: "Inbox", hideIfCan: "leads" },
  { href: "/admin/disputes", label: "Disputes & flags", perm: ["disputes", "flags"], group: "Inbox" },

  { href: "/admin/people", label: "Everyone", perm: ["people", "mentors"], group: "People", also: ["/admin/mentors"], otherwise: { unless: "people", href: "/admin/mentors" } },
  { href: "/admin/minors", label: "Under 18", perm: "minors", group: "People" },

  { href: "/admin/orders", label: "Orders & payouts", perm: "orders", group: "Money" },

  { href: "/admin/calls", label: "Calls & recordings", perm: "calls", group: "Calls" },

  { href: "/admin/website", label: "Pages", perm: "website", group: "Website" },
  { href: "/admin/emails", label: "Emails", perm: "emails", group: "Website", also: ["/admin/email-log"] },
  { href: "/admin/outbox", label: "Outbox", perm: "emails", group: "Website" },
  { href: "/admin/legal", label: "Legal", perm: "legal", group: "Website" },
  { href: "/admin/services", label: "Services", perm: "services", group: "Website" },

  { href: "/admin/insights", label: "Insights", perm: "insights", group: "Reports" },
  { href: "/admin/analytics", label: "Analytics", perm: "analytics", group: "Reports" },
  { href: "/admin/action-log", label: "Action log", perm: "actionlog", group: "Reports" },

  { href: "/admin/team", label: "Team & roles", perm: "team", group: "Settings" },
];

export function visibleAdminNav(user: { perms: readonly string[] }) {
  return ADMIN_NAV.filter((n) => n.ready !== false && can(user, n.perm) && !(n.hideIfCan && can(user, n.hideIfCan))).map((n) =>
    n.otherwise && !can(user, n.otherwise.unless) ? { ...n, href: n.otherwise.href } : n
  );
}

// Where to send someone whose role can't see the Overview.
export function firstAdminPage(user: { perms: readonly string[] }) {
  return visibleAdminNav(user)[0]?.href ?? null;
}
