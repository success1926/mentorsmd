"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, GoogleButton } from "@/components/AuthShell";
import { browserTimeZone } from "@/lib/tz";

export default function StudentSignupPage() {
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
      body: JSON.stringify({ name, email, password, timeZone: browserTimeZone() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }
    await signIn("credentials", { email, password, redirect: false });
    router.push("/mentors");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: 40 }}>Create your account</h1>
          <span className="text-secondary">Free for students. Message any vetted mentor before you book.</span>
        </div>
        <GoogleButton onClick={() => signIn("google", { callbackUrl: "/mentors" })} label="Sign up with Google" />
        <div className="or-line">or</div>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="field-help">At least 8 characters.</span>
          </label>
          {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading || !name || !email || password.length < 8}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <span className="text-muted" style={{ textAlign: "center" }}>
          By creating an account you agree to our <Link href="/terms" className="link">Terms</Link> and <Link href="/privacy" className="link">Privacy Policy</Link>.
        </span>
        <span className="text-secondary" style={{ textAlign: "center" }}>
          Already have an account? <Link href="/login" className="link">Log in</Link>
        </span>
        <span className="text-muted" style={{ textAlign: "center" }}>
          Want to mentor? <Link href="/become-a-mentor" className="link">Mentoring is invite-only</Link>.
        </span>
      </div>
    </AuthShell>
  );
}
