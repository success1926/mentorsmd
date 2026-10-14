import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { can, type AdminPermission } from "@/lib/adminPermissions";
import { firstAdminPage } from "@/lib/adminNav";
import { money } from "@/lib/options";

export const dynamic = "force-dynamic";

// Admin -> Overview: what needs attention, each linking to its page. Only
// the areas the admin's role includes are counted and shown. Someone whose
// role doesn't include the Overview lands on their first page instead.
export default async function AdminOverviewPage() {
  const admin = await currentAdmin();
  if (!admin) return null; // the layout already shows "Admin access required"
  if (!can(admin, "overview")) {
    const first = firstAdminPage(admin);
    if (first && first !== "/admin") redirect(first);
    return (
      <div className="page">
        <div className="alert alert-blue">Your role doesn&apos;t include any part of Admin yet. Ask the Owner.</div>
      </div>
    );
  }

  const when = <T,>(perm: AdminPermission, q: () => Promise<T>) => (can(admin, perm) ? q() : Promise.resolve(null));
  const [disputes, flags, highFlags, applications, held, awaitingApproval, consents] = await Promise.all([
    when("disputes", () => prisma.order.count({ where: { disputed: true, status: { in: ["IN_ESCROW", "COMPLETED"] } } })),
    when("flags", () => prisma.flag.count({ where: { status: "OPEN" } })),
    when("flags", () => prisma.flag.count({ where: { status: "OPEN", severity: { gte: 3 } } })),
    when("applications", () => prisma.mentorApplication.count({ where: { status: "PENDING" } })),
    when("orders", () => prisma.order.aggregate({ where: { status: { in: ["IN_ESCROW", "COMPLETED"] } }, _count: true, _sum: { amount: true } })),
    when("orders", () => prisma.order.count({ where: { status: "COMPLETED", disputed: false } })),
    when("minors", () => prisma.user.count({ where: { minorStatus: "PENDING" } })),
  ]);

  const cards: { label: string; value: string; note?: string; href: string; urgent: boolean }[] = [];
  if (disputes !== null) cards.push({ label: "Open disputes", value: String(disputes), href: "/admin/disputes#disputes", urgent: disputes > 0 });
  if (flags !== null) cards.push({ label: "Open flags", value: String(flags), note: highFlags ? `${highFlags} high` : undefined, href: "/admin/disputes#flags", urgent: (highFlags ?? 0) > 0 });
  if (applications !== null) cards.push({ label: "Mentor applications waiting", value: String(applications), href: can(admin, "leads") ? "/admin/leads?tab=APPLICATION" : "/admin/applications", urgent: applications > 0 });
  if (held !== null) {
    cards.push({
      label: "Payouts pending",
      value: money(held._sum.amount ?? 0),
      note: `${held._count} order${held._count === 1 ? "" : "s"} held${awaitingApproval ? ` · ${awaitingApproval} delivered, waiting for the student` : ""}`,
      href: "/admin/orders",
      urgent: false,
    });
  }
  if (consents !== null) cards.push({ label: "Under-18 consents waiting", value: String(consents), href: "/admin/minors", urgent: false });

  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Overview</h1>
        <p className="lede">What needs attention right now. Everything else is in the menu.</p>
      </div>
      {cards.length === 0 ? (
        <p className="text-muted">Nothing to show for your role here. Use the menu to open your pages.</p>
      ) : (
        <div className="adm-overview">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className="card adm-stat">
              <span className="text-secondary">{c.label}</span>
              <span className="stat-num">{c.value}</span>
              {c.note && <span className="text-muted small">{c.note}</span>}
              {c.urgent && <span className="badge badge-warning adm-stat-flag">Needs attention</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
