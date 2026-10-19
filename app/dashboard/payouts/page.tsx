"use client";

import { useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/ui";
import { money } from "@/lib/options";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { shortHours } from "@/lib/hours";
import { PAYOUT_STATUS_LABEL, payoutDayLabel, periodLabel } from "@/lib/payoutRules";

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
  const [earnings, setEarnings] = useState<any>(null);

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
    fetch("/api/me/payouts")
      .then((r) => r.json())
      .then(setEarnings)
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

  const past: any[] = earnings?.past || [];
  const paidTotal = past.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="page-mid stack-lg">
      <div className="stack-sm">
        <h1 className="page-title">Payouts</h1>
        <p className="lede">Paid monthly, on the 24th, for every hour you work. You keep {100 - PLATFORM_FEE_PERCENT}%; MentorsMD keeps {PLATFORM_FEE_PERCENT}%.</p>
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
          <span className="text-secondary">You&apos;re set. Your monthly payout goes to your bank automatically on the 24th.</span>
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
        <div className="stat-card" style={{ background: "var(--blue)" }}>
          <span className="text-secondary">Earned, not yet paid</span>
          <span className="stat-num">{earnings ? money(earnings.unpaidCents) : "…"}</span>
          <span className="text-muted">{earnings ? `Next payout: ${payoutDayLabel(earnings.nextPayoutDay)}` : ""}{earnings?.heldCents > 0 ? ` · ${money(earnings.heldCents)} held by a dispute` : ""}</span>
        </div>
        <div className="stat-card">
          <span className="text-secondary">Paid to you</span>
          <span className="stat-num">{money(paidTotal)}</span>
          <span className="text-muted">{past.filter((p) => p.status === "PAID").length} monthly payout{past.filter((p) => p.status === "PAID").length === 1 ? "" : "s"}, after the {PLATFORM_FEE_PERCENT}% fee</span>
        </div>
      </div>

      <div className="card stack-sm">
        <b className="row"><Icon d={ICONS.lock} size={18} /> How payouts work</b>
        <ol className="text-secondary" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Students pay MentorsMD for hours at your rate.</li>
          <li>Each call held and each block of written work you log is added to your earnings ({100 - PLATFORM_FEE_PERCENT}% of the hour).</li>
          <li>When a package is approved (by the student, or automatically after 48 hours), its unused hours are added too.</li>
          <li>On the 24th of each month, everything not yet paid goes to your bank in one Stripe payout. Hours on a package with an open dispute wait until it&apos;s decided.</li>
        </ol>
      </div>

      {past.length > 0 && (
        <details className="collapse" open>
          <summary>Payout history ({past.length})</summary>
          <div className="collapse-body">
            {past.map((p) => (
              <div key={p.id} className="list-row">
                <span className="grow">{periodLabel(p.period)} · {shortHours(p.minutes)}</span>
                <span className="text-muted">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : p.status === "FAILED" ? "Delayed, we're on it" : PAYOUT_STATUS_LABEL[p.status] || p.status}</span>
                <b>{money(p.amountCents)}</b>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
