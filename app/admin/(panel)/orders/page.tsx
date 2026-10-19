"use client";

import { Orders } from "@/components/admin/sections/Orders";

export default function AdminOrdersPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Orders & payouts</h1>
        <p className="lede">Money collected (cards and credit), the platform fee, the monthly payouts to mentors, and what hasn't been paid out yet.</p>
      </div>
      <Orders />
    </div>
  );
}
