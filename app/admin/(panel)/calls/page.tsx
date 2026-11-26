"use client";

import { CallsAdmin } from "@/components/admin/sections/Calls";
import { PageHeader } from "@/components/ui";

export default function AdminCallsPage() {
  return (
    <div className="page">
      <PageHeader title="Calls & recordings" lede="Upcoming and past calls, who joined, and recordings for checking problems." />
      <CallsAdmin />
    </div>
  );
}
