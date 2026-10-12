"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Tabs across the admin pages.
const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/insights", label: "Insights" },
  { href: "/admin/legal", label: "Legal" },
  { href: "/admin/minors", label: "Under 18" },
  { href: "/admin/team", label: "Team" },
];

export function AdminNav() {
  const pathname = usePathname() || "/admin";
  return (
    <nav className="tabs" aria-label="Admin sections" style={{ marginBottom: 0 }}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="tab" aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminGuard({ status, isAdmin }: { status: string; isAdmin: boolean }) {
  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  return null;
}
