import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { currentAdmin, PENDING_2FA_ROLE } from "@/lib/adminTeam";
import { visibleAdminNav, visibleAdminTools } from "@/lib/adminNav";
import { SITE_PAGES, SITE_PAGE_KEYS } from "@/lib/siteContent";
import { can } from "@/lib/adminPermissions";
import { newLeadCount } from "@/lib/leads";
import { openSafetyCount } from "@/lib/flags";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

export const dynamic = "force-dynamic";

// Sidebar labels are in Title Case ("Become a mentor" -> "Become a Mentor").
const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);
const titleCase = (s: string) =>
  s.replace(/[A-Za-z][\w']*/g, (w, i: number) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));

// Every admin page except /admin/verify. Logged-out visitors never get
// here (middleware.ts sends them to /login); admins who haven't finished
// 2-step verification go to /admin/verify; everyone else needs an active
// admin account. Each section then checks its own permission
// (components/admin/AdminSection.tsx). The 1-hour "Still there?" logout
// is in components/SessionWatcher.tsx, on every page.
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role === PENDING_2FA_ROLE) redirect("/admin/verify");
  const admin = await currentAdmin();
  if (!admin) {
    return (
      <div className="page-narrow">
        <div className="alert alert-danger">Admin access required.</div>
      </div>
    );
  }
  const me = { id: admin.id, name: admin.name, email: admin.email, isOwner: admin.adminRole === "OWNER", roleName: admin.roleName, perms: admin.perms };
  // Leads badge: new contact messages + pending applications nobody has picked up.
  // Disputes & flags badge: open disputes + open flags, whichever the role includes.
  // Orders & payouts badge: monthly payouts that failed and need a Retry.
  const [leadsBadge, safetyBadge, payoutsBadge] = await Promise.all([
    can(admin, "leads") ? newLeadCount(can(admin, "applications")) : 0,
    openSafetyCount(can(admin, "disputes"), can(admin, "flags")),
    can(admin, "orders") ? prisma.mentorPayout.count({ where: { status: "FAILED" } }).catch(() => 0) : 0,
  ]);
  const badges: Record<string, number> = { "/admin/leads": leadsBadge, "/admin/disputes": safetyBadge, "/admin/orders": payoutsBadge };
  const nav = visibleAdminNav(admin).map((n) => (badges[n.href] ? { ...n, badge: badges[n.href] } : n));
  // Website pages for the sidebar (only for roles that can edit the website).
  const sitePages = can(admin, "website") ? SITE_PAGE_KEYS.map((key) => ({ key, label: titleCase(SITE_PAGES[key].label) })) : [];
  return (
    <AdminShell me={me} nav={nav} sitePages={sitePages} tools={visibleAdminTools(admin)}>
      {children}
    </AdminShell>
  );
}
