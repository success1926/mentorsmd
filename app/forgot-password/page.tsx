"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Something went wrong. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="card-narrow">
      <h1 style={{ fontSize: 28, margin: "0 0 6px" }}>Reset your password</h1>
      {sent ? (
        <>
          <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>
            If an account exists for <b>{email}</b>, we've emailed a link to choose a new password. It expires in 1 hour.
          </p>
          <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>
            Don't see it? Check your spam folder, or wait a minute and try again.
          </p>
          <Link href="/login" className="btn" style={{ width: "100%", marginTop: 8 }}>Back to log in</Link>
        </>
      ) : (
        <>
          <p className="text-secondary" style={{ marginBottom: 22, fontSize: 15 }}>
            Enter the email you signed up with and we'll send you a reset link.
          </p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" className="input" placeholder="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {error && <div role="alert" style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>{error}</div>}
            <button className="btn-primary" disabled={loading || !email}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
          <p className="text-secondary" style={{ textAlign: "center", marginTop: 16 }}>
            <Link href="/login" style={{ color: "var(--primary-deep)", fontWeight: 600 }}>Back to log in</Link>
          </p>
        </>
      )}
    </div>
  );
}
