// Admin permissions: one tick box per admin area (Admin -> Team -> Roles).
//
//  - Owners and Admins always have every permission ("*"). Nothing about
//    them changes when custom roles exist.
//  - A team member with a custom role (User.adminRoleId) only gets the
//    areas ticked on that role. The server checks this on every admin page
//    and API (currentAdmin(key) in lib/adminTeam.ts); hiding sidebar items
//    is only a convenience.
//
// Safe to import in the browser (no database).

export const ADMIN_PERMISSIONS = [
  { key: "overview", label: "Overview (counts that need attention)", group: "General" },
  { key: "mentors", label: "Mentor invites", group: "Marketplace" },
  { key: "applications", label: "Mentor applications", group: "Marketplace" },
  { key: "people", label: "People (mentors and students)", group: "Marketplace" },
  { key: "orders", label: "Orders, payouts and money (earnings, refunds, releases)", group: "Marketplace" },
  { key: "services", label: "Custom services", group: "Marketplace" },
  { key: "leads", label: "Leads", group: "Marketplace" },
  { key: "disputes", label: "Disputes", group: "Safety" },
  { key: "flags", label: "Flags queue", group: "Safety" },
  { key: "calls", label: "Calls and recordings", group: "Safety" },
  { key: "minors", label: "Students under 18", group: "Safety" },
  { key: "website", label: "Website editor", group: "Content & legal" },
  { key: "emails", label: "Emails and email log", group: "Content & legal" },
  { key: "legal", label: "Legal documents", group: "Content & legal" },
  { key: "insights", label: "Insights", group: "Settings" },
  { key: "actionlog", label: "Action log", group: "Settings" },
  { key: "team", label: "Team (view; only Owners can change it)", group: "Settings" },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]["key"];
export const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((p) => p.key) as AdminPermission[];
export const ADMIN_PERMISSION_GROUPS = Array.from(new Set(ADMIN_PERMISSIONS.map((p) => p.group)));

// Full access, stored for Owners and Admins.
export const ALL_PERMISSIONS = "*";

// One key, or a list meaning "any of these".
export type PermissionCheck = AdminPermission | readonly AdminPermission[];

// Anyone who can open an order from Admin (disputes, calls, people's
// recent orders, flags about an order) can view it.
export const ORDER_VIEW_PERMISSIONS: readonly AdminPermission[] = ["orders", "disputes", "flags", "calls", "people"];

export function can(user: { perms: readonly string[] } | null | undefined, check: PermissionCheck): boolean {
  if (!user) return false;
  if (user.perms.includes(ALL_PERMISSIONS)) return true;
  const keys: readonly string[] = typeof check === "string" ? [check] : check;
  return keys.some((k) => user.perms.includes(k));
}

// Keeps only real permission keys (for saving a role).
export function cleanPermissions(input: unknown): AdminPermission[] {
  if (!Array.isArray(input)) return [];
  return ADMIN_PERMISSION_KEYS.filter((k) => input.includes(k));
}
