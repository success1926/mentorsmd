import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { currentAdmin, PENDING_2FA_ROLE } from "@/lib/adminTeam";
import { visibleAdminNav } from "@/lib/adminNav";
import { can } from "@/lib/adminPermissions";
import { newLeadCount } from "@/lib/leads";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

export const dynamic = "force-dynamic";

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
  const me = { id: admin.id, name: admin.name, isOwner: admin.adminRole === "OWNER", roleName: admin.roleName, perms: admin.perms };
  // Leads badge: new contact messages + pending applications nobody has picked up.
  const leadsBadge = can(admin, "leads") ? await newLeadCount(can(admin, "applications")) : 0;
  const nav = visibleAdminNav(admin).map((n) => (n.href === "/admin/leads" && leadsBadge ? { ...n, badge: leadsBadge } : n));
  return (
    <AdminShell me={me} nav={nav}>
      {children}
    </AdminShell>
  );
}
