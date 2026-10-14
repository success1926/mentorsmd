"use client";

import { CallsAdmin } from "@/components/admin/sections/Calls";

export default function AdminCallsPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Calls & recordings</h1>
        <p className="lede">Upcoming and past calls, who joined, and recordings for checking problems.</p>
      </div>
      <CallsAdmin />
    </div>
  );
}
