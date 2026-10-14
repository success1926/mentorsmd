"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/lib/adminNav";
import { can, type PermissionCheck } from "@/lib/adminPermissions";

// Admin layout: grouped sidebar on the left (a Menu button on phones that
// opens it as a drawer), the page on the right. The server works out who
// is logged in and which items they may see (app/admin/(panel)/layout.tsx).

export type AdminMe = { id: string; name: string; isOwner: boolean; roleName: string; perms: string[] };

const AdminMeContext = createContext<AdminMe | null>(null);

// The logged-in admin, for hiding buttons their role can't use (the
// server refuses them anyway).
export function useAdminMe() {
  return useContext(AdminMeContext);
}
export function useAdminCan(check: PermissionCheck) {
  return can(useAdminMe(), check);
}

export function AdminShell({ me, nav, children }: { me: AdminMe; nav: AdminNavItem[]; children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const groups = Array.from(new Set(nav.map((n) => n.group)));
  const current = nav.find((n) => isActive(pathname, n));

  return (
    <AdminMeContext.Provider value={me}>
      <div className="adm-shell">
        <nav className={`adm-side${open ? " is-open" : ""}`} aria-label="Admin sections">
          <div className="adm-side-top">
            <b className="adm-brand">Admin</b>
            <span className="adm-current">{current?.label}</span>
            <button type="button" className="btn btn-sm adm-menu-btn" aria-expanded={open} aria-controls="adm-nav-list" onClick={() => setOpen(!open)}>
              {open ? "Close" : "Menu"}
            </button>
          </div>
          <div id="adm-nav-list" className="adm-nav-list">
            {groups.map((g) => (
              <div key={g} className="adm-group" role="group" aria-label={g}>
                {g !== "General" && <div className="adm-group-label">{g}</div>}
                {nav.filter((n) => n.group === g).map((n) => (
                  <Link key={n.href} href={n.href} className="adm-link" aria-current={isActive(pathname, n) ? "page" : undefined}>
                    {n.label}
                    {!!n.badge && <span className="tab-count" aria-label={`${n.badge} new`}>{n.badge}</span>}
                  </Link>
                ))}
              </div>
            ))}
            <div className="adm-me small">
              <b>{me.name}</b>
              <span className="badge">{me.roleName}</span>
            </div>
          </div>
        </nav>
        <main className="adm-main">{children}</main>
      </div>
    </AdminMeContext.Provider>
  );
}

function isActive(pathname: string, n: AdminNavItem) {
  return pathname === n.href || (!n.exact && pathname.startsWith(n.href + "/"));
}
