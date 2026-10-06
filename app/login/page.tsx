"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, GoogleButton } from "@/components/AuthShell";

// Only allow redirects back into this site.
function safeCallback() {
  const cb = new URLSearchParams(window.location.search).get("callbackUrl") || "";
  return cb.startsWith("/") && !cb.startsWith("//") ? cb : "";
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // ?reason=idle when a login ran out, ?reason=ended when it was ended
  // elsewhere (e.g. a password change on another device).
  const reason = useSearchParams()?.get("reason") || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setLoading(false);
      setError("That email or password isn't right. After several failed attempts an account is locked for 15 minutes. Resetting your password unlocks it right away.");
      return;
    }
    // Send each role to its home.
    const session = await fetch("/api/auth/session").then((r) => r.json()).catch(() => ({}));
    const role = session?.user?.role;
    const cb = safeCallback();
    router.push(cb || (role === "SELLER" ? "/dashboard" : role === "ADMIN" ? "/admin" : "/mentors"));
    router.refresh();
  }

  return (
    <AuthShell title="Welcome back." body="Pick up where you left off: messages, orders and calls are all in one place.">
      <div className="stack" style={{ gap: 14 }}>
        <h1 className="page-title" style={{ fontSize: 40 }}>Log in</h1>
        {reason === "idle" && (
          <div role="status" className="alert alert-warning">
            You were logged out due to inactivity. Log in to pick up where you left off.
          </div>
        )}
        {reason === "ended" && (
          <div role="status" className="alert alert-warning">
            Your session ended. Please log in again.
          </div>
        )}
        <GoogleButton onClick={() => signIn("google", { callbackUrl: safeCallback() || "/mentors" })} />
        <span className="text-muted">Google sign-in is for student accounts. Mentors log in with email.</span>
        <div className="or-line">or</div>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label between">
              Password
              <Link href="/forgot-password" className="link small">Forgot password?</Link>
            </span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading || !email || !password}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <span className="text-secondary" style={{ textAlign: "center" }}>
          New here? <Link href="/signup" className="link">Create a free student account</Link>
        </span>
      </div>
    </AuthShell>
  );
}
