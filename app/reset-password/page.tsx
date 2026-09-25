"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
        <p className="text-secondary" style={{ fontSize: 15 }}>This link is missing its reset code. Request a new one.</p>
        <Link href="/forgot-password" className="btn btn-solid" style={{ width: "100%" }}>Request a new link</Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <p className="text-secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>Your password has been changed. You can log in with it now.</p>
        <Link href="/login" className="btn btn-solid" style={{ width: "100%" }}>Log in</Link>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="pw" className="text-secondary" style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>New password</label>
      <input id="pw" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label htmlFor="pw2" className="text-secondary" style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Confirm new password</label>
      <input id="pw2" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <p className="text-muted" style={{ marginTop: -4 }}>At least 8 characters.</p>
      {error && (
        <div role="alert" style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12 }}>
          {error}{" "}
          {error.includes("Request a new one") && <Link href="/forgot-password" style={{ textDecoration: "underline" }}>Request a new link</Link>}
        </div>
      )}
      <button className="btn-primary" disabled={loading || !password || !confirm}>
        {loading ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="card-narrow">
      <h1 style={{ fontSize: 28, margin: "0 0 18px" }}>Choose a new password</h1>
      {/* useSearchParams needs a Suspense boundary in the Next.js app router */}
      <Suspense fallback={<p className="text-secondary">Loading...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
