"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlagsAdmin } from "@/components/admin/Flags";
import { Disputes } from "@/components/admin/sections/Disputes";
import { useAdminCan } from "@/components/admin/AdminShell";

// Admin -> Disputes & flags. Each half shows if the role includes it.
export default function AdminDisputesPage() {
  const canFlags = useAdminCan("flags");
  const canDisputes = useAdminCan("disputes");
  const [disputes, setDisputes] = useState<{ open: any[]; resolved: any[] }>({ open: [], resolved: [] });

  const loadDisputes = useCallback(() => {
    if (!canDisputes) return;
    fetch("/api/admin/disputed-orders").then((r) => r.json()).then((d) => setDisputes({ open: d.open || [], resolved: d.resolved || [] })).catch(() => {});
  }, [canDisputes]);
  useEffect(loadDisputes, [loadDisputes]);
  // After a decision, also refresh the sidebar's Disputes & flags badge
  // (it's counted on the server when the page loads).
  const router = useRouter();
  const changed = useCallback(() => {
    loadDisputes();
    router.refresh();
  }, [loadDisputes, router]);

  return (
    <div className="page stack-lg" style={{ gap: 36 }}>
      <div className="stack-sm">
        <h1 className="page-title">Disputes &amp; flags</h1>
        <p className="lede">Reports, automatic flags and disputes. Payment on a disputed order stays held until someone decides.</p>
      </div>
      {canFlags && <FlagsAdmin onChanged={changed} />}
      {canDisputes && <Disputes disputes={disputes} onResolved={changed} />}
    </div>
  );
}
