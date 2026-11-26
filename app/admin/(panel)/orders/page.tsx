"use client";

import { Orders } from "@/components/admin/sections/Orders";
import { PageHeader } from "@/components/ui";

export default function AdminOrdersPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <PageHeader title="Orders & payouts" lede="Money collected (cards and credit), the platform fee, the monthly payouts to mentors, and what hasn't been paid out yet." />
      <Orders />
    </div>
  );
}
