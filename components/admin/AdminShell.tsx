"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/lib/adminNav";
import { can, type PermissionCheck } from "@/lib/adminPermissions";

// Admin layout: grouped sidebar on the left (a Menu button on phones that
// opens it as a drawer), the page on the right. A group with one item is
// a plain link; bigger groups fold open and shut, start open when they
// hold the current page, and remember what was left open on this device. The server works out who
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

const OPEN_GROUPS_KEY = "adm-open-groups";

export function AdminShell({ me, nav, children }: { me: AdminMe; nav: AdminNavItem[]; children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const groups = Array.from(new Set(nav.map((n) => n.group)));
  const current = nav.find((n) => isActive(pathname, n));
  const [openGroups, setOpenGroups] = useState<string[]>(current ? [current.group] : []);
  useEffect(() => {
    let saved: string[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || "[]");
    } catch {}
    setOpenGroups(Array.from(new Set([...saved, ...(current ? [current.group] : [])])));
  }, [current?.group]);
  function toggleGroup(g: string) {
    const next = openGroups.includes(g) ? openGroups.filter((x) => x !== g) : [...openGroups, g];
    setOpenGroups(next);
    try {
      localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(next));
    } catch {}
  }
  const link = (n: AdminNavItem) => (
    <Link key={n.href} href={n.href} className="adm-link" aria-current={isActive(pathname, n) ? "page" : undefined}>
      {n.label}
      {!!n.badge && <span className="tab-count" aria-label={`${n.badge} new`}>{n.badge}</span>}
    </Link>
  );

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
            {groups.map((g) => {
              const items = nav.filter((n) => n.group === g);
              if (items.length === 1) return <div key={g} className="adm-group">{link(items[0])}</div>;
              const isOpen = openGroups.includes(g);
              const badge = items.reduce((sum, n) => sum + (n.badge ?? 0), 0);
              return (
                <div key={g} className="adm-group" role="group" aria-label={g}>
                  <button type="button" className="adm-group-btn" aria-expanded={isOpen} onClick={() => toggleGroup(g)}>
                    <span>{g}</span>
                    {!isOpen && badge > 0 && <span className="tab-count" aria-label={`${badge} new`}>{badge}</span>}
                    <span className="adm-caret" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && <div className="adm-group-items">{items.map(link)}</div>}
                </div>
              );
            })}
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

// The item's own page, a page under it, or one of its `also` pages.
function isActive(pathname: string, n: AdminNavItem) {
  return [n.href, ...(n.also ?? [])].some((href) => pathname === href || (!n.exact && pathname.startsWith(href + "/")));
}
