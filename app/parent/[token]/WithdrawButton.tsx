"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";

export function WithdrawButton({ token, name }: { token: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const { confirm, dialog } = useConfirm();

  async function withdraw() {
    if (!(await confirm({ title: "Withdraw your consent?", body: `${name}'s account will be paused right away.`, confirmLabel: "Withdraw consent", danger: true }))) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/parent/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Something went wrong");
    setDone(true);
  }

  if (done) return <Alert tone="success">Consent withdrawn. {name}&apos;s account is paused, and our team will be in touch about any open orders.</Alert>;
  return (
    <div className="stack-sm">
      {error && <Alert tone="danger">{error}</Alert>}
      <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={withdraw}>{busy ? "Withdrawing…" : "Withdraw consent"}</button>
      {dialog}
    </div>
  );
}
