"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { money } from "@/lib/options";

const PLATFORM_FEE_PERCENT = 20; // keep in sync with lib/stripe.ts

type Status = { connected: boolean; started: boolean; outstandingItems?: string[]; error?: string };

// Turns Stripe requirement ids like "individual.verification.document"
// into something a person can read.
function readable(item: string) {
  return item
    .replace(/[._]/g, " ")
    .replace(/\bdob\b/i, "date of birth")
    .replace(/\bssn last 4\b/i, "last 4 of SSN")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default function PayoutsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  function loadStatus() {
    setChecking(true);
    fetch("/api/stripe/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ connected: false, started: false, error: "Couldn't check status" }))
      .finally(() => setChecking(false));
  }

  useEffect(() => {
    loadStatus();
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => {});
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Stripe didn't return a link. Try again in a minute.");
    } catch (err: any) {
      setError(err.message || "Something went wrong contacting the server.");
    }
    setConnecting(false);
  }

  const net = (cents: number) => cents - Math.round((cents * PLATFORM_FEE_PERCENT) / 100);
  const paid = orders.filter((o) => o.status === "RELEASED");
  const held = orders.filter((o) => ["IN_ESCROW", "COMPLETED"].includes(o.status));
  const paidTotal = paid.reduce((s, o) => s + net(o.amount), 0);
  const heldTotal = held.reduce((s, o) => s + net(o.amount), 0);

  return (
    <div className="page-mid stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Payouts</h1>
        <p className="lede">Get paid when students approve your work. MentorsMD keeps {PLATFORM_FEE_PERCENT}%.</p>
      </div>

      <div className="card stack">
        <div className="between">
          <b style={{ fontSize: 18 }}>Bank account</b>
          {!checking && status?.connected && <span className="badge badge-success">✓ Connected</span>}
          {!checking && status && !status.connected && <span className="badge badge-warning">{status.started ? "Setup not finished" : "Not connected"}</span>}
        </div>
        {checking ? (
          <span className="text-muted">Checking status…</span>
        ) : status?.connected ? (
          <span className="text-secondary">You&apos;re set. Payments go to your bank automatically when an order is released.</span>
        ) : (
          <>
            <span className="text-secondary">
              {status?.started
                ? "You started setup, but Stripe still needs a bit more before you can be paid."
                : "Connect a bank account to get paid. Stripe collects your bank details, tax info and ID directly. None of it is stored on MentorsMD."}
            </span>
            {status?.outstandingItems && status.outstandingItems.length > 0 && (
              <div className="alert alert-warning">
                <b>Stripe still needs:</b>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {status.outstandingItems.map((item, i) => <li key={i}>{readable(item)}</li>)}
                </ul>
              </div>
            )}
            <button onClick={handleConnect} disabled={connecting} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
              {connecting ? "Opening Stripe…" : status?.started ? "Finish setup" : "Connect bank account"}
            </button>
            {error && <div role="alert" className="alert alert-danger">{error}</div>}
          </>
        )}
        {!checking && (
          <button onClick={loadStatus} className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", color: "var(--muted)" }}>
            Refresh status
          </button>
        )}
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="stat-card">
          <span className="text-secondary">Paid to you</span>
          <span className="stat-num">{money(paidTotal)}</span>
          <span className="text-muted">{paid.length} order{paid.length === 1 ? "" : "s"}, after the {PLATFORM_FEE_PERCENT}% fee</span>
        </div>
        <div className="stat-card" style={{ background: "var(--blue)" }}>
          <span className="text-secondary">Held, waiting for approval</span>
          <span className="stat-num">{money(heldTotal)}</span>
          <span className="text-muted">{held.length} active order{held.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="card stack-sm">
        <b className="row"><Icon d={ICONS.lock} size={18} /> How payouts work</b>
        <ol className="text-secondary" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>The student pays when they book. MentorsMD holds it.</li>
          <li>You deliver and mark the order complete.</li>
          <li>The student approves, or it releases automatically after 96 hours.</li>
          <li>Stripe sends it to your bank, usually within 2 business days.</li>
        </ol>
      </div>

      {paid.length > 0 && (
        <details className="collapse">
          <summary>Payout history ({paid.length})</summary>
          <div className="collapse-body">
            {paid.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="list-row">
                <span className="grow">{o.gig.title} · {o.buyer?.name}</span>
                <span className="text-muted">{o.completedAt ? new Date(o.completedAt).toLocaleDateString() : ""}</span>
                <b>{money(net(o.amount))}</b>
              </Link>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
