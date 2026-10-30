"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem, AdminTool } from "@/lib/adminNav";
import { can, type PermissionCheck } from "@/lib/adminPermissions";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { logOut } from "@/components/TopNav";

// Admin layout: grouped sidebar on the left (a Menu button on phones that
// opens it as a drawer), the page on the right. A group with one item is
// a plain link; bigger groups fold open and shut, start open when they
// hold the current page, and remember what was left open on this device.
// The search box (AdminSearch) sits at the top of the list. The server works out who
// is logged in and which items they may see (app/admin/(panel)/layout.tsx).
// Website lists every editable page (`sitePages`) so each is one click
// away, then Site Settings and All Pages. "Other Tools" (outside
// dashboards, `tools`) sits at the bottom. The account menu (AccountMenu)
// is in the top row: initials, then name, email, role and links.

export type AdminMe = { id: string; name: string; email: string; isOwner: boolean; roleName: string; perms: string[] };
export type AdminSitePage = { key: string; label: string };

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

export function AdminShell({ me, nav, sitePages = [], tools = [], children }: { me: AdminMe; nav: AdminNavItem[]; sitePages?: AdminSitePage[]; tools?: AdminTool[]; children: React.ReactNode }) {
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
  const link = (n: AdminNavItem) => {
    // Website -> Pages: every page one click away, then Site Settings and All Pages.
    if (n.href === "/admin/website" && sitePages.length) {
      const sub = (href: string, label: string) => (
        <Link key={href} href={href} className="adm-link adm-sublink" aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      );
      return (
        <div key={n.href} className="adm-pages" role="group" aria-label="Website pages">
          {sitePages.filter((p) => p.key !== "siteSettings").map((p) => sub(`/admin/website/${p.key}`, p.label))}
          {sitePages.some((p) => p.key === "siteSettings") && sub("/admin/website/siteSettings", "Site Settings")}
          {sub("/admin/website", "All Pages")}
        </div>
      );
    }
    return (
      <Link key={n.href} href={n.href} className="adm-link" aria-current={isActive(pathname, n) ? "page" : undefined}>
        {n.label}
        {!!n.badge && <span className="tab-count" aria-label={`${n.badge} new`}>{n.badge}</span>}
      </Link>
    );
  };
  // The page name in the phone top bar (a website page's own name when editing one).
  const editingPage = sitePages.find((p) => pathname === `/admin/website/${p.key}`);
  const currentLabel = pathname === "/admin/account" ? "Account & Security" : editingPage ? (editingPage.key === "siteSettings" ? "Site Settings" : editingPage.label) : current?.label;
  const toolsOpen = openGroups.includes("Other Tools");

  return (
    <AdminMeContext.Provider value={me}>
      <div className="adm-shell">
        <nav className={`adm-side${open ? " is-open" : ""}`} aria-label="Admin sections">
          <div className="adm-side-top">
            <b className="adm-brand">Admin</b>
            <span className="adm-current">{currentLabel}</span>
            <AccountMenu me={me} />
            <button type="button" className="btn btn-sm adm-menu-btn" aria-expanded={open} aria-controls="adm-nav-list" onClick={() => setOpen(!open)}>
              {open ? "Close" : "Menu"}
            </button>
          </div>
          <div id="adm-nav-list" className="adm-nav-list">
            <AdminSearch />
            <div className="adm-nav-scroll">
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
              {tools.length > 0 && (
                <div className="adm-group adm-tools" role="group" aria-label="Other Tools">
                  <button type="button" className="adm-group-btn" aria-expanded={toolsOpen} onClick={() => toggleGroup("Other Tools")}>
                    <span>Other Tools</span>
                    <span className="adm-caret" aria-hidden="true">{toolsOpen ? "▾" : "▸"}</span>
                  </button>
                  {toolsOpen && (
                    <div className="adm-group-items">
                      {tools.map((t) => (
                        <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer" className="adm-link adm-tool">
                          <span>{t.label}</span>
                          <span className="adm-tool-note">
                            {t.note} <span aria-hidden="true">↗</span>
                            <span className="sr-only"> (opens in a new tab)</span>
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>
        <main className="adm-main">{children}</main>
      </div>
    </AdminMeContext.Provider>
  );
}

// The small account menu in the sidebar's top row: initials, then (open)
// name, email, role, Account & Security, View the Website and Log Out.
// Closes after picking a page, on a click elsewhere, or on Escape.
function AccountMenu({ me }: { me: AdminMe }) {
  const box = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => box.current?.removeAttribute("open"), [pathname]);
  useEffect(() => {
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && box.current.removeAttribute("open");
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && box.current?.open) {
        box.current.removeAttribute("open");
        box.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const initials = (me.name || me.email).replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <details className="adm-me" ref={box}>
      <summary aria-label={`Account menu for ${me.name || me.email}`}>
        <span className="adm-avatar" aria-hidden="true">{initials}</span>
      </summary>
      <div className="adm-me-pop">
        <div className="adm-me-head">
          <b>{me.name || me.email}</b>
          <span>{me.email}</span>
          <span className="badge" style={{ alignSelf: "flex-start", marginTop: 6 }}>{me.roleName}</span>
        </div>
        <Link href="/admin/account">Account &amp; Security</Link>
        <a href="/" target="_blank" rel="noopener noreferrer">
          View the Website <span aria-hidden="true">↗</span>
        </a>
        <button type="button" className="adm-me-out" onClick={() => logOut("/login")}>Log Out</button>
      </div>
    </details>
  );
}

// The item's own page, a page under it, or one of its `also` pages.
function isActive(pathname: string, n: AdminNavItem) {
  return [n.href, ...(n.also ?? [])].some((href) => pathname === href || (!n.exact && pathname.startsWith(href + "/")));
}
