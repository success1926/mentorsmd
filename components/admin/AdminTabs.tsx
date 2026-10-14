"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminMe } from "@/components/admin/AdminShell";
import { can, type PermissionCheck } from "@/lib/adminPermissions";

// A row of tabs at the top of an admin page that link between related
// pages (People and Mentor invites; Emails and the Email log). Each tab
// only shows if the role includes it, and the row hides when only one is
// left. A tab is current when its link is the page you're on, unless
// `selected` says otherwise (tabs that only change a ?filter).
export type AdminTab = { href: string; label: string; perm: PermissionCheck; count?: number | null; selected?: boolean };

export function AdminTabs({ tabs, label }: { tabs: AdminTab[]; label: string }) {
  const pathname = usePathname();
  const me = useAdminMe();
  const shown = tabs.filter((t) => can(me, t.perm));
  if (shown.length < 2) return null;
  return (
    <nav className="tabs" aria-label={label}>
      {shown.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={(t.selected ?? pathname === t.href) ? "page" : undefined}>
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

// Admin -> Everyone: mentors and students (People) plus Mentor invites.
// `role` and `counts` come from the People list when it's the page shown.
export function PeopleTabs({ role, counts }: { role?: "SELLER" | "BUYER"; counts?: { mentors: number; students: number } | null }) {
  return (
    <AdminTabs
      label="Everyone"
      tabs={[
        { href: "/admin/people?role=SELLER", label: "Mentors", perm: "people", count: counts?.mentors, selected: role === "SELLER" },
        { href: "/admin/people?role=BUYER", label: "Students", perm: "people", count: counts?.students, selected: role === "BUYER" },
        { href: "/admin/mentors", label: "Mentor invites", perm: "mentors" },
      ]}
    />
  );
}

// Admin -> Emails: the templates and the log of what was sent.
export function EmailTabs() {
  return (
    <AdminTabs
      label="Emails"
      tabs={[
        { href: "/admin/emails", label: "Templates", perm: "emails" },
        { href: "/admin/email-log", label: "Sent log", perm: "emails" },
      ]}
    />
  );
}
