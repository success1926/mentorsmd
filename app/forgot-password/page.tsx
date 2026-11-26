"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Field } from "@/components/ui";
import { Honeypot, useRecaptcha, RecaptchaNotice } from "@/components/FormGuards";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [trap, setTrap] = useState("");
  const recaptcha = useRecaptcha();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, website: trap, recaptchaToken: await recaptcha("forgot_password") }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Something went wrong. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell title="Locked out?" body="It happens. We'll email you a link to choose a new password, and you'll be back to your messages, packages and calls.">
      <div className="stack">
      <h1 className="auth-title">Reset your password</h1>
      {sent ? (
        <>
          <p className="text-secondary">
            If an account exists for <b>{email}</b>, we've emailed a link to choose a new password. It expires in 1 hour.
          </p>
          <p className="text-secondary">
            Don't see it? Check your spam folder, or wait a minute and try again.
          </p>
          <Link href="/login" className="btn btn-block" style={{ marginTop: 8 }}>Back to log in</Link>
        </>
      ) : (
        <>
          <p className="text-secondary" style={{ marginBottom: 22 }}>
            Enter the email you signed up with and we'll send you a reset link.
          </p>
          <form onSubmit={handleSubmit}>
            <Field id="email" label="Email">
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Honeypot value={trap} onChange={setTrap} />
            {error && <Alert tone="danger" style={{ marginBottom: 12 }}>{error}</Alert>}
            <button className="btn btn-primary btn-lg btn-block" disabled={loading || !email}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <RecaptchaNotice />
          </form>
          <p className="text-secondary" style={{ textAlign: "center", marginTop: 16 }}>
            <Link href="/login" className="link">Back to log in</Link>
          </p>
        </>
      )}
      </div>
    </AuthShell>
  );
}
