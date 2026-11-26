"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Field } from "@/components/ui";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("The two passwords don't match");
    setLoading(true);
    setError("");
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Something went wrong. Try again.");
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <>
        <p className="text-secondary">This link is missing its reset code. Request a new one.</p>
        <Link href="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <p className="text-secondary">Your password has been changed. You can log in with it now.</p>
        <Link href="/login" className="btn btn-primary btn-block">Log in</Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field id="pw" label="New password" help="At least 8 characters.">
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field id="pw2" label="Confirm new password">
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          {error}{" "}
          {error.includes("Request a new one") && <Link href="/forgot-password" className="link">Request a new link</Link>}
        </Alert>
      )}
      <button className="btn btn-primary btn-lg btn-block" disabled={loading || !password || !confirm}>
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Almost there" body="Choose a new password and you'll be back to your messages, packages and calls.">
      <div className="stack">
        <h1 className="auth-title">Choose a new password</h1>
        {/* useSearchParams needs a Suspense boundary in the Next.js app router */}
        <Suspense fallback={<p className="text-secondary">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </AuthShell>
  );
}
