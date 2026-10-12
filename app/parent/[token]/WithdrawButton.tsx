"use client";

import { useState } from "react";

export function WithdrawButton({ token, name }: { token: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function withdraw() {
    if (!confirm(`Withdraw your consent? ${name}'s account will be paused right away.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/parent/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Something went wrong");
    setDone(true);
  }

  if (done) return <div className="alert alert-success" role="status">Consent withdrawn. {name}&apos;s account is paused, and our team will be in touch about any open orders.</div>;
  return (
    <div className="stack-sm">
      {error && <div role="alert" className="alert alert-danger">{error}</div>}
      <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={withdraw}>{busy ? "Withdrawing…" : "Withdraw consent"}</button>
    </div>
  );
}
