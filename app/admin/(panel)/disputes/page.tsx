"use client";

import { useCallback, useEffect, useState } from "react";
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

  return (
    <div className="page stack-lg" style={{ gap: 36 }}>
      <div className="stack-sm">
        <h1 className="page-title">Disputes &amp; flags</h1>
        <p className="lede">Reports, automatic flags and disputes. Payment on a disputed order stays held until someone decides.</p>
      </div>
      {canFlags && <FlagsAdmin onChanged={loadDisputes} />}
      {canDisputes && <Disputes disputes={disputes} onResolved={loadDisputes} />}
    </div>
  );
}
