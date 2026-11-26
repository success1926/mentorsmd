"use client";

// Student "My packages" (/orders), redesign Oct 2026 (docs/redesign-2026-10.md
// section 8): every package, with tabs Active / Waiting on you / Completed
// (title, mentor, hours-left bar, status, new messages). Each one opens its
// package page (/orders/[id]), the one place a package is shown in full.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { PackageRow } from "@/components/PackageRow";
import { useNavStatus } from "@/components/NavStatus";
import { finishPhase } from "@/lib/finishing";

type Filter = "active" | "waiting" | "done";
const TABS: [Filter, string][] = [
  ["active", "Active"],
  ["waiting", "Waiting on you"],
  ["done", "Completed"],
];

function inFilter(p: any, f: Filter) {
  const phase = finishPhase(p);
  if (f === "waiting") return phase === "AWAITING_STUDENT";
  if (f === "active") return phase === "WORKING" || phase === "AWAITING_STUDENT" || phase === "DISPUTED";
  return phase === "APPROVED" || phase === "CLOSED";
}

export function MyPackages() {
  const [packages, setPackages] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  // MentorsMD credit: the page's one status load (components/NavStatus.tsx).
  const credit = useNavStatus()?.student?.creditCents ?? 0;

  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => setPackages((p) => p ?? []));
  }, []);

  const counts = useMemo(() => {
    const list = packages || [];
    return { active: list.filter((p) => inFilter(p, "active")).length, waiting: list.filter((p) => inFilter(p, "waiting")).length, done: list.filter((p) => inFilter(p, "done")).length };
  }, [packages]);
  // Start on "Waiting on you" when something needs an answer.
  useEffect(() => {
    if (packages && counts.waiting > 0) setFilter("waiting");
  }, [packages, counts.waiting]);

  const list = (packages || []).filter((p) => inFilter(p, filter));

  return (
    <div className="page">
      <PageHeader
        title="My packages"
        lede="Everything you've bought, with hours, calls, messages and files."
        actions={
          <>
            {credit > 0 && <Link href="/credit" className="badge badge-brand" title="Applied automatically at checkout, with any mentor. Never expires.">MentorsMD credit: {money(credit)}</Link>}
            <Link href="/mentors" className="btn btn-primary">Find a mentor</Link>
          </>
        }
      />

      {packages === null ? (
        <LoadingBlock title={false} lines={2} cards={3} />
      ) : packages.length === 0 ? (
        <EmptyState title="No packages yet" action={<Link href="/mentors" className="btn btn-primary">Browse mentors</Link>}>
          Message a mentor or book a free 15-minute intro call, then buy hours or a package from their profile.
        </EmptyState>
      ) : (
        <>
          <div className="tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" className="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
                {label} <span className="tab-count">{counts[k]}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState>{filter === "waiting" ? "Nothing needs your answer right now." : filter === "active" ? "No active packages." : "No completed packages yet."}</EmptyState>
          ) : (
            <div className="card pkg-entry-list">
              {list.map((p) => <PackageRow key={p.id} p={p} audience="student" showCalls />)}
            </div>
          )}
          <p className="text-muted small">Waiting on you: packages your mentor marked complete. Completed packages stay here with their messages and files.</p>
        </>
      )}
    </div>
  );
}
