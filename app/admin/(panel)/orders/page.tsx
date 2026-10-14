"use client";

import { Orders } from "@/components/admin/sections/Orders";

export default function AdminOrdersPage() {
  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Orders & payouts</h1>
        <p className="lede">Money collected, the platform fee, what has been paid to mentors and what is still held.</p>
      </div>
      <Orders />
    </div>
  );
}
