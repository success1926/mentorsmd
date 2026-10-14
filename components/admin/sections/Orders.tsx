"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { money } from "@/lib/options";

// Admin -> Orders & payouts: the earnings cards, and each paid order with
// the platform fee and what the mentor gets (from /api/admin/earnings).
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  IN_ESCROW: { label: "Payment held", cls: "badge-warning" },
  COMPLETED: { label: "Delivered, waiting for approval", cls: "badge-warning" },
  RELEASED: { label: "Paid to mentor", cls: "badge-success" },
};

export function Orders() {
  const [earnings, setEarnings] = useState<any>(null);
  const [filter, setFilter] = useState<"ALL" | "HELD" | "RELEASED">("ALL");
  useEffect(() => {
    fetch("/api/admin/earnings").then((r) => r.json()).then(setEarnings).catch(() => setEarnings({ orders: [] }));
  }, []);

  const orders: any[] = earnings?.orders || [];
  const list = orders.filter((o) => (filter === "ALL" ? true : filter === "RELEASED" ? o.status === "RELEASED" : o.status !== "RELEASED"));

  return (
    <>
      {earnings?.totalCollectedCents !== undefined && (
        <div className="stat-cards">
          {[
            ["Total collected", earnings.totalCollectedCents, "var(--tint-soft)"],
            [`Your ${PLATFORM_FEE_PERCENT}% cut`, earnings.platformCutCents, "var(--pink-soft)"],
            ["Paid to mentors", earnings.paidToSellersCents, "var(--blue)"],
            ["Held right now", earnings.inEscrowCents, "var(--tint-soft)"],
          ].map(([label, cents, bg]: any) => (
            <div key={label} className="stat-card" style={{ background: bg }}>
              <span className="text-secondary">{label}</span>
              <span className="stat-num">{money(cents)}</span>
            </div>
          ))}
        </div>
      )}

      <section className="stack-sm">
        <h2 style={{ fontSize: 30 }}>Paid orders</h2>
        <div className="tabs" role="tablist">
          {([["ALL", "All"], ["HELD", "Payment held"], ["RELEASED", "Paid to mentor"]] as const).map(([k, label]) => (
            <button key={k} role="tab" className="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <div className="card" style={{ padding: "4px 20px" }}>
          {!earnings && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
          {earnings && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No orders here yet.</p>}
          {list.map((o) => {
            const st = STATUS_LABEL[o.status] || { label: o.status, cls: "" };
            return (
              <div key={o.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2, minWidth: 200 }}>
                  <b style={{ fontSize: 15 }}>{o.gigTitle}</b>
                  <span className="text-muted">{o.buyerName} (student) with {o.sellerName} (mentor)</span>
                </div>
                <span className="text-muted small">{money(o.amountCents)} · fee {money(o.platformFeeCents)} · mentor gets {money(o.sellerPayoutCents)}</span>
                <span className={`badge ${st.cls}`}>{st.label}</span>
                <Link href={`/orders/${o.id}`} className="btn btn-sm">Open order</Link>
              </div>
            );
          })}
        </div>
        <span className="text-muted small">Refunds and releases are done from Disputes &amp; flags, or from the order itself. Mentors are paid through Stripe Connect.</span>
      </section>
    </>
  );
}
