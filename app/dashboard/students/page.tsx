"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { HoursBar, LowHoursBadge, PackageBadge } from "@/components/Packages";
import { MinorBadge, tintFor, initialsOf } from "@/components/ui";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, shortHours } from "@/lib/hours";

// Students & packages (mentor area v2, Oct 2026): every hours package the
// mentor has, active and past, with the student, title, hours used and
// left, status and new messages. Filters: Active (everything still open,
// including packages waiting on the student), Waiting on student (marked
// complete, 48 hours to respond) and Completed. Each row opens the
// package page (/orders/[id]).

type Filter = "active" | "waiting" | "done";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "waiting", label: "Waiting on student" },
  { key: "done", label: "Completed" },
];

function inFilter(p: any, f: Filter) {
  const phase = finishPhase(p);
  if (f === "waiting") return phase === "AWAITING_STUDENT";
  if (f === "active") return phase === "WORKING" || phase === "AWAITING_STUDENT" || phase === "DISPUTED";
  return phase === "APPROVED" || phase === "CLOSED";
}

export default function StudentsAndPackagesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [packages, setPackages] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  useEffect(() => {
    if (role !== "SELLER") return;
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => setPackages([]));
  }, [role]);

  const counts = useMemo(() => {
    const list = packages || [];
    return Object.fromEntries(FILTERS.map((f) => [f.key, list.filter((p) => inFilter(p, f.key)).length])) as Record<Filter, number>;
  }, [packages]);

  if (session && role !== "SELLER") return <div className="page-narrow"><div className="alert">This page is for mentor accounts. <Link href="/orders" className="link">My packages</Link></div></div>;

  const shown = (packages || []).filter((p) => inFilter(p, filter));

  return (
    <div className="page-mid stack-lg" style={{ gap: 20 }}>
      <div className="stack-sm">
        <h1 className="page-title">Students &amp; packages</h1>
        <p className="lede">Every package students have bought from you, with the hours used and left.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Filter packages">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" className="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
            {packages && <span className="tab-count">{counts[f.key]}</span>}
          </button>
        ))}
      </div>

      {packages === null && <span className="text-muted">Loading…</span>}
      {packages !== null && shown.length === 0 && (
        <div className="empty">
          {filter === "active" ? "No active packages right now. When a student buys hours or a package from you, it shows up here." : filter === "waiting" ? "Nothing is waiting on a student." : "No completed packages yet."}
        </div>
      )}
      {shown.length > 0 && (
        <div className="card" style={{ padding: "4px 20px" }}>
          {shown.map((p) => {
            const h = hoursSummary(p);
            const used = h.purchased - h.left;
            return (
              <div key={p.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <span className="avatar" style={{ background: tintFor(p.buyer?.name || ""), width: 40, height: 40, fontSize: 15 }}>{initialsOf(p.buyer?.name || "")}</span>
                <div className="grow stack-sm" style={{ gap: 4, minWidth: 220 }}>
                  <span className="row-wrap" style={{ gap: 6 }}>
                    <b style={{ fontSize: 15 }}>{p.buyer?.name}</b>
                    <MinorBadge person={p.buyer} />
                  </span>
                  <span className="text-secondary">{p.title}</span>
                  <HoursBar order={p} thin />
                  <span className="text-muted small">
                    {shortHours(used)} used · {shortHours(h.left)} left of {shortHours(h.purchased)} · {h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held
                  </span>
                </div>
                <LowHoursBadge order={p} />
                <PackageBadge order={p} />
                {p.newMessages > 0 && <span className="count-badge" aria-label={`${p.newMessages} new messages`}>{p.newMessages}</span>}
                <Link href={`/orders/${p.id}`} className="btn btn-sm btn-soft">Open package</Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
