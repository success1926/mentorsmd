"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("That email or password isn't right. After several failed attempts an account is locked for 15 minutes. Resetting your password unlocks it right away.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="card-narrow">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Log in</h2>
      <p className="text-secondary" style={{ marginBottom: 22 }}>Welcome back.</p>

      <button onClick={() => signIn("google", { callbackUrl: "/" })} className="btn" style={{ width: "100%", marginBottom: 16 }}>
        Continue with Google
      </button>
      <div className="text-muted" style={{ textAlign: "center", marginBottom: 16 }}>or</div>

      <form onSubmit={handleSubmit}>
        <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div style={{ textAlign: "right", marginTop: -4, marginBottom: 12 }}>
          <Link href="/forgot-password" style={{ fontSize: 14, fontWeight: 600, color: "var(--primary-deep)" }}>Forgot password?</Link>
        </div>
        {error && <div role="alert" style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" disabled={loading || !email || !password}>
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
