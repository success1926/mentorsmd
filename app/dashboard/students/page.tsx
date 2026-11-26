"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PackageRow } from "@/components/PackageRow";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { finishPhase } from "@/lib/finishing";

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

  if (session && role !== "SELLER") return <div className="page"><div className="alert">This page is for mentor accounts. <Link href="/orders" className="link">My packages</Link></div></div>;

  const shown = (packages || []).filter((p) => inFilter(p, filter));

  return (
    <div className="page">
      <PageHeader title="Students &amp; packages" lede="Every package students have bought from you, with the hours used and left." />

      <div className="tabs" role="tablist" aria-label="Filter packages">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" className="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label} <span className="tab-count">{packages ? counts[f.key] : "…"}</span>
          </button>
        ))}
      </div>

      {packages === null ? (
        <LoadingBlock title={false} lines={2} cards={3} />
      ) : shown.length === 0 ? (
        <EmptyState>
          {filter === "active" ? "No active packages right now. When a student buys hours or a package from you, it shows up here." : filter === "waiting" ? "Nothing is waiting on a student." : "No completed packages yet."}
        </EmptyState>
      ) : (
        <div className="card pkg-entry-list">
          {shown.map((p) => (
            <PackageRow key={p.id} p={p} audience="mentor" showCalls actions={<Link href={`/orders/${p.id}`} className="btn btn-sm btn-soft">Open package</Link>} />
          ))}
        </div>
      )}
    </div>
  );
}
