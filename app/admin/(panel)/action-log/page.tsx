"use client";

import { ActionLog } from "@/components/admin/Flags";

export default function AdminActionLogPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Action log</h1>
        <p className="lede">Every admin decision, with who did it and when.</p>
      </div>
      <ActionLog />
    </div>
  );
}
