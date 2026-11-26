"use client";

import { ActionLog } from "@/components/admin/Flags";
import { PageHeader } from "@/components/ui";

export default function AdminActionLogPage() {
  return (
    <div className="page">
      <PageHeader title="Action log" lede="Every admin decision, with who did it and when." />
      <ActionLog />
    </div>
  );
}
