import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { can, type AdminPermission } from "@/lib/adminPermissions";
import { firstAdminPage } from "@/lib/adminNav";
import { NEEDS_ADMIN } from "@/lib/callOutcomes";
import { LEAD_KIND_LABEL } from "@/lib/leadOptions";
import { money } from "@/lib/options";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const fmtWhen = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

// Admin -> Overview: the first screen after logging in. A greeting, what
// needs attention (only rows with something waiting), a few numbers at a
// glance and the latest activity, each linking to its page. Only the areas
// the admin's role includes are counted and shown. Someone whose role
// doesn't include the Overview lands on their first page instead.
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

  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86400_000);
  const sixtyDaysAgo = new Date(now - 60 * 86400_000);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const paidStatuses = ["IN_ESCROW", "COMPLETED", "RELEASED", "REFUNDED"] as const;
  // Each query runs only if the role includes its area (null otherwise),
  // and a failure (say, a table not set up yet) shows as nothing rather
  // than breaking the page.
  const when = <T,>(perm: AdminPermission | AdminPermission[], q: () => Promise<T>): Promise<T | null> =>
    can(admin, perm)
      ? q().catch((err) => {
          console.error("Overview query failed:", err);
          return null;
        })
      : Promise.resolve(null);

  const [
    disputes, flags, highFlags, applications, contacts, waitlist, undecidedCalls, failedPayouts, giftsToReview, drafts, consents,
    sales, held, newStudents, newMentors, recentLeads, recentApps, recentOrders,
  ] = await Promise.all([
    when("disputes", () => prisma.order.count({ where: { disputed: true, status: { in: ["IN_ESCROW", "COMPLETED"] } } })),
    when("flags", () => prisma.flag.count({ where: { status: "OPEN" } })),
    when("flags", () => prisma.flag.count({ where: { status: "OPEN", severity: { gte: 3 } } })),
    when("applications", () => prisma.mentorApplication.count({ where: { status: "PENDING" } })),
    when("leads", () => prisma.lead.count({ where: { kind: "CONTACT", status: "NEW" } })),
    when("leads", () => prisma.lead.count({ where: { kind: "WAITLIST", status: "NEW" } })),
    // Past calls the site couldn't decide (nobody joined, or unclear), as listed in Calls.
    when("calls", () => prisma.callBooking.count({ where: { outcome: { in: [...NEEDS_ADMIN] }, status: { not: "CANCELLED" }, endTime: { gte: sixtyDaysAgo, lt: new Date(now) } } })),
    when("orders", () => prisma.mentorPayout.count({ where: { status: "FAILED" } })),
    when("orders", () => prisma.gift.count({ where: { status: "NEEDS_REVIEW" } })),
    // Pages with a saved draft that differs from the live page (publishing or discarding clears the draft).
    when("website", async () => {
      const rows = await prisma.siteContent.findMany({ where: { draft: { not: Prisma.DbNull } }, select: { draft: true, live: true } });
      return rows.filter((r) => JSON.stringify(r.draft) !== JSON.stringify(r.live)).length;
    }),
    when("minors", () => prisma.user.count({ where: { minorStatus: "PENDING" } })),
    when("orders", () =>
      prisma.order.aggregate({
        where: { status: { in: [...paidStatuses] }, OR: [{ paidAt: { gte: monthStart } }, { paidAt: null, createdAt: { gte: monthStart } }] },
        _count: true,
        _sum: { amount: true },
      })
    ),
    when("orders", () => prisma.order.aggregate({ where: { status: { in: ["IN_ESCROW", "COMPLETED"] } }, _count: true, _sum: { amount: true } })),
    when("people", () => prisma.user.count({ where: { role: "BUYER", createdAt: { gte: weekAgo } } })),
    when(["people", "mentors"], () => prisma.user.count({ where: { role: "SELLER", createdAt: { gte: weekAgo } } })),
    when("leads", () => prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, kind: true, name: true, email: true, status: true, createdAt: true } })),
    when("applications", () => prisma.mentorApplication.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, status: true, createdAt: true } })),
    when("orders", () =>
      prisma.order.findMany({
        where: { status: { in: [...paidStatuses] } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, amount: true, packageTitle: true, createdAt: true, paidAt: true, gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
      })
    ),
  ]);

  // What needs someone's attention, most important first. Rows with
  // nothing waiting are left out.
  const leadsHref = (tab: string, id?: string) => `/admin/leads?tab=${tab}${id ? `&open=${id}` : ""}`;
  const appsHref = (id?: string) => (can(admin, "leads") ? leadsHref("APPLICATION", id) : "/admin/applications");
  const todo: { count: number; label: string; href: string }[] = [
    { count: disputes ?? 0, label: `Open ${plural(disputes ?? 0, "dispute")}`, href: "/admin/disputes#disputes" },
    { count: flags ?? 0, label: `Open ${plural(flags ?? 0, "flag")}${highFlags ? ` (${highFlags} high)` : ""}`, href: "/admin/disputes#flags" },
    { count: failedPayouts ?? 0, label: `Failed ${plural(failedPayouts ?? 0, "payout")} to retry`, href: "/admin/orders" },
    { count: undecidedCalls ?? 0, label: `Past ${plural(undecidedCalls ?? 0, "call")} waiting for your decision`, href: "/admin/calls" },
    { count: consents ?? 0, label: `Under-18 ${plural(consents ?? 0, "student")} waiting for parent consent`, href: "/admin/minors" },
    { count: applications ?? 0, label: `New mentor ${plural(applications ?? 0, "application")}`, href: appsHref() },
    { count: contacts ?? 0, label: `New contact ${plural(contacts ?? 0, "message")}`, href: leadsHref("CONTACT") },
    { count: waitlist ?? 0, label: `New waitlist ${plural(waitlist ?? 0, "signup")}`, href: leadsHref("WAITLIST") },
    { count: giftsToReview ?? 0, label: `Parent ${plural(giftsToReview ?? 0, "gift")} needing a look`, href: "/admin/orders" },
    { count: drafts ?? 0, label: `Website ${plural(drafts ?? 0, "page")} with unpublished changes`, href: "/admin/website" },
  ].filter((t) => t.count > 0);

  // Latest activity: newest leads, applications and paid packages together.
  const activity = [
    ...(recentLeads ?? []).map((l) => ({
      key: `lead-${l.id}`,
      at: l.createdAt,
      title: l.name || l.email,
      sub: LEAD_KIND_LABEL[l.kind as keyof typeof LEAD_KIND_LABEL] ?? "Lead",
      isNew: l.status === "NEW",
      href: leadsHref(l.kind, l.id),
    })),
    ...(recentApps ?? []).map((a) => ({
      key: `app-${a.id}`,
      at: a.createdAt,
      title: a.name,
      sub: "Mentor application",
      isNew: a.status === "PENDING",
      href: appsHref(a.id),
    })),
    ...(recentOrders ?? []).map((o) => ({
      key: `order-${o.id}`,
      at: o.paidAt ?? o.createdAt,
      title: o.packageTitle || o.gig.title,
      sub: `${o.buyer.name} (student) with ${o.seller.name} (mentor) · ${money(o.amount)}`,
      isNew: false,
      href: `/orders/${o.id}`,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const glance: { label: string; value: string }[] = [];
  if (sales) glance.push({ label: "Package sales this month", value: `${money(sales._sum.amount ?? 0)} · ${sales._count} ${plural(sales._count, "package")}` });
  if (held) glance.push({ label: "Held for mentors (not paid out yet)", value: money(held._sum.amount ?? 0) });
  if (newStudents !== null) glance.push({ label: "New students (7 days)", value: String(newStudents) });
  if (newMentors !== null) glance.push({ label: "New mentors (7 days)", value: String(newMentors) });
  glance.push({ label: "Your role", value: admin.roleName });

  // Shortcuts to the most common jobs, each only if the role includes it.
  const quick = [
    { label: "Invite a Mentor", href: "/admin/mentors", perm: "mentors" },
    { label: "Edit the Website", href: "/admin/website", perm: "website" },
    { label: "Open Leads", href: "/admin/leads", perm: "leads" },
  ].filter((q) => can(admin, q.perm as AdminPermission));
  const showActivity = can(admin, ["leads", "applications", "orders"]);
  const first = (admin.name || "").trim().split(/\s+/)[0];

  return (
    <div className="page stack-lg adm-dash" style={{ gap: 28 }}>
      <div className="adm-dash-head">
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1 className="page-title">{first ? `Hi, ${first}` : "Welcome"}</h1>
          <p className="text-secondary">What needs attention right now. Everything else is in the menu.</p>
        </div>
        <div className="row-wrap" style={{ gap: 8 }}>
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="btn btn-soft btn-sm">{q.label}</Link>
          ))}
          <a href="/" target="_blank" rel="noopener noreferrer" className="btn btn-sm">
            View the Website <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <section className="card adm-dash-card" aria-labelledby="dash-todo">
        <h2 id="dash-todo" className="adm-card-title">Needs Attention</h2>
        {todo.length === 0 ? (
          <p className="text-muted">All caught up. Nothing is waiting for you.</p>
        ) : (
          <ul className="adm-todo">
            {todo.map((t) => (
              <li key={t.label}>
                <Link href={t.href}>
                  <b className="adm-todo-count">{t.count}</b>
                  <span>{t.label}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="adm-dash-grid">
        {showActivity && (
          <section className="card adm-dash-card" aria-labelledby="dash-recent">
            <h2 id="dash-recent" className="adm-card-title">Latest Activity</h2>
            {activity.length === 0 ? (
              <p className="text-muted">Nothing here yet. New leads, applications and packages show up here.</p>
            ) : (
              <ul className="adm-feed">
                {activity.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href}>
                      <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                        <b>{a.title}</b>
                        <span className="text-muted small">{a.sub} · {fmtWhen(a.at)}</span>
                      </span>
                      {a.isNew && <span className="badge badge-brand">New</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="card adm-dash-card" aria-labelledby="dash-glance">
          <h2 id="dash-glance" className="adm-card-title">At a Glance</h2>
          <dl className="adm-glance">
            {glance.map((g) => (
              <div key={g.label}>
                <dt>{g.label}</dt>
                <dd>{g.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
