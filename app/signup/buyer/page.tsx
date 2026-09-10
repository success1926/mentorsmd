"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function BuyerSignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup/buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    // Signed up successfully - log them straight in rather than making
    // them fill out the login form again right after.
    await signIn("credentials", { email, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="card-narrow">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Create a buyer account</h2>
      <p className="text-secondary" style={{ marginBottom: 22 }}>Open to any student — no approval needed.</p>

      <button onClick={() => signIn("google", { callbackUrl: "/" })} className="btn" style={{ width: "100%", marginBottom: 16 }}>
        Continue with Google
      </button>
      <div className="text-muted" style={{ textAlign: "center", marginBottom: 16 }}>or</div>

      <form onSubmit={handleSubmit}>
        <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" disabled={loading || !name || !email || !password}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
