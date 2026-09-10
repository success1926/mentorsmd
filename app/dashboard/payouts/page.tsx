"use client";

import { useEffect, useState } from "react";

export default function PayoutsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ connected: boolean; started: boolean; outstandingItems?: string[] } | null>(null);
  const [checking, setChecking] = useState(true);

  function loadStatus() {
    setChecking(true);
    fetch("/api/stripe/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .finally(() => setChecking(false));
  }

  useEffect(loadStatus, []);

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError(data.error || "Stripe didn't return a redirect link.");
    } catch (err: any) {
      setError(err.message || "Something went wrong contacting the server.");
    }
    setLoading(false);
  }

  return (
    <div className="card-narrow">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Payouts</h2>

      {checking ? (
        <p className="text-muted">Checking status...</p>
      ) : status?.connected ? (
        <>
          <div className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", marginBottom: 16 }}>
            ✓ Connected
          </div>
          <p className="text-secondary">
            Your bank account is connected. You'll be paid automatically whenever a buyer releases an order.
          </p>
        </>
      ) : (
        <>
          <p className="text-secondary" style={{ marginBottom: 22 }}>
            {status?.started
              ? "You started setup but didn't finish it - Stripe still needs a bit more information before you can get paid out."
              : "Connect a bank account so you can get paid when a buyer releases an order. Stripe collects your bank details, tax info, and identity verification directly — none of it is stored on this site."}
          </p>
          {status?.started && status?.outstandingItems && status.outstandingItems.length > 0 && (
            <div className="card" style={{ marginBottom: 16, padding: 12 }}>
              <div className="text-secondary" style={{ marginBottom: 6, fontWeight: 600 }}>Still needed:</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#5B6A61" }}>
                {status.outstandingItems.map((item: string, i: number) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {/* Temporary debug view - shows exactly what Stripe returned,
              unconditionally, so we can see the real shape of the data
              rather than guessing. Safe to remove once this is confirmed
              working correctly. */}
          {status?.started && (
            <details open style={{ marginBottom: 16, fontSize: 12 }}>
              <summary className="text-muted" style={{ cursor: "pointer" }}>Raw Stripe data (debug)</summary>
              <pre style={{ whiteSpace: "pre-wrap", background: "#F3F6F4", padding: 10, borderRadius: 6, marginTop: 8, fontSize: 11, overflow: "auto", maxHeight: 300 }}>
                {JSON.stringify((status as any).rawAccount || status, null, 2)}
              </pre>
            </details>
          )}
          <button onClick={handleConnect} disabled={loading} className="btn-primary">
            {loading ? "Redirecting..." : status?.started ? "Finish setup" : "Connect bank account"}
          </button>
          {error && <p style={{ color: "#DC2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
        </>
      )}

      {!checking && (
        <button onClick={loadStatus} className="btn" style={{ marginTop: 16, background: "none", border: "none", padding: 0, fontSize: 12, color: "#5B6A61" }}>
          Refresh status
        </button>
      )}
    </div>
  );
}
