import { ALL_PERMISSIONS, can, type AdminPermission, type PermissionCheck } from "@/lib/adminPermissions";
import { CYCLE_RESULTS_ON } from "@/lib/cycleResults";

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
  { href: "/admin/applications", label: "Mentor Applications", perm: "applications", group: "Inbox", hideIfCan: "leads" },
  { href: "/admin/disputes", label: "Disputes & Flags", perm: ["disputes", "flags"], group: "Inbox" },

  { href: "/admin/people", label: "Everyone", perm: ["people", "mentors"], group: "People", also: ["/admin/mentors"], otherwise: { unless: "people", href: "/admin/mentors" } },
  { href: "/admin/minors", label: "Under 18", perm: "minors", group: "People" },

  { href: "/admin/orders", label: "Orders & Payouts", perm: "orders", group: "Money" },

  { href: "/admin/calls", label: "Calls & Recordings", perm: "calls", group: "Calls" },

  { href: "/admin/website", label: "Pages", perm: "website", group: "Website" },
  { href: "/admin/emails", label: "Emails", perm: "emails", group: "Website", also: ["/admin/email-log"] },
  { href: "/admin/outbox", label: "Outbox", perm: "emails", group: "Website" },
  { href: "/admin/legal", label: "Legal", perm: "legal", group: "Website" },
  { href: "/admin/services", label: "Services", perm: "services", group: "Website" },

  { href: "/admin/insights", label: "Insights", perm: "insights", group: "Reports" },
  { href: "/admin/analytics", label: "Analytics", perm: "analytics", group: "Reports" },
  { href: "/admin/action-log", label: "Action Log", perm: "actionlog", group: "Reports" },
  // Read-only; only while NEXT_PUBLIC_CYCLE_RESULTS=1 (lib/cycleResults.ts).
  { href: "/admin/results", label: "Cycle Results", perm: "people", group: "Reports", ready: CYCLE_RESULTS_ON },

  { href: "/admin/team", label: "Team & Roles", perm: "team", group: "Settings" },
];

export function visibleAdminNav(user: { perms: readonly string[] }) {
  return ADMIN_NAV.filter((n) => n.ready !== false && can(user, n.perm) && !(n.hideIfCan && can(user, n.hideIfCan))).map((n) =>
    n.otherwise && !can(user, n.otherwise.unless) ? { ...n, href: n.otherwise.href } : n
  );
}

// "Other Tools" at the bottom of the sidebar: the outside dashboards,
// opened in a new tab. `perm: "full"` means Owners and Admins only (full
// access); the others follow the area they belong to.
export type AdminTool = { label: string; note: string; href: string; perm: PermissionCheck | "full" };
export const ADMIN_TOOLS: AdminTool[] = [
  { label: "Stripe", note: "Payments", href: "https://dashboard.stripe.com", perm: "orders" },
  { label: "Vercel", note: "Hosting", href: "https://vercel.com/dashboard", perm: "full" },
  { label: "Neon", note: "Database", href: "https://console.neon.tech", perm: "full" },
  { label: "Resend", note: "Email sending", href: "https://resend.com/emails", perm: "full" },
  { label: "Supabase", note: "Files & live updates", href: "https://supabase.com/dashboard", perm: "full" },
  { label: "PostHog", note: "Visitor analytics", href: "https://us.posthog.com", perm: "analytics" },
  { label: "Daily", note: "Video calls", href: "https://dashboard.daily.co", perm: "full" },
];

export function visibleAdminTools(user: { perms: readonly string[] }) {
  return ADMIN_TOOLS.filter((t) => (t.perm === "full" ? user.perms.includes(ALL_PERMISSIONS) : can(user, t.perm)));
}

// Where to send someone whose role can't see the Overview.
export function firstAdminPage(user: { perms: readonly string[] }) {
  return visibleAdminNav(user)[0]?.href ?? null;
}
