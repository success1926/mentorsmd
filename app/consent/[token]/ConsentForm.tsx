"use client";

import { useState } from "react";
import { Alert, Field } from "@/components/ui";
import { fmtDay } from "@/lib/format";

export function ConsentForm({ token, studentName, expiresAt }: { token: string; studentName: string; expiresAt: string }) {
  const [signature, setSignature] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"consent" | "decline" | null>(null);
  const first = studentName.split(" ")[0];

  async function send(action: "consent" | "decline") {
    if (action === "decline" && !window.confirm(`Don't allow ${first} to use MentorsMD? Their account stays paused.`)) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/consent/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, signature, confirm }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Something went wrong");
    setDone(action);
  }

  if (done) {
    return (
      <Alert tone={done === "consent" ? "success" : "warning"} className="stack-sm">
        {done === "consent" ? (
          <>
            <b>Thank you. Your consent is recorded and {first}&apos;s account is now active.</b>
            <span>We emailed you a private link where you can see {first}&apos;s orders and calls, or withdraw your consent at any time. You&apos;ll also get a receipt for every order.</span>
          </>
        ) : (
          <>
            <b>Got it. {first}&apos;s account stays paused.</b>
            <span>We&apos;ve let them know. Nothing else is needed from you.</span>
          </>
        )}
      </Alert>
    );
  }

  return (
    <section className="card stack">
      <h2 className="block-title">Sign</h2>
      <label className="check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          I am {studentName}&apos;s parent or legal guardian. I have read the Parental Consent form and the Terms of Service, and I consent to {first} using MentorsMD.
        </span>
      </label>
      <Field id="consent-signature" label="Type your full name as your signature" help="Typing your name here counts as your electronic signature. We record it with the date, time, your IP address and browser.">
        <input className="input" autoComplete="name" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="First and last name" />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="row-wrap">
        <button className="btn btn-primary btn-lg" disabled={busy || !confirm || signature.trim().length < 3} onClick={() => send("consent")}>
          {busy ? "Saving…" : "I consent"}
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => send("decline")}>I don&apos;t consent</button>
      </div>
      <span className="text-muted small">This link works until {fmtDay(expiresAt)}.</span>
    </section>
  );
}
