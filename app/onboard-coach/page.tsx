"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

// useSearchParams() requires a Suspense boundary around it for Next.js's
// production build to prerender this page correctly - this wrapper is
// the fix; all the real logic lives in OnboardCoachForm below, unchanged.
export default function OnboardCoachPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading...</p>}>
      <OnboardCoachForm />
    </Suspense>
  );
}

function OnboardCoachForm() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code") || "";
  const emailFromLink = params.get("email") || "";

  const [email] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!code || !emailFromLink) {
    return (
      <div className="card-narrow">
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Missing invite link</h2>
        <p className="text-secondary">
          This page only works from the invite email an admin sends you. Ask them to resend it if you've lost it.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/signup/seller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email, password, name, credential, bio }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card-narrow">
      <h2 style={{ fontSize: 20, marginBottom: 6 }}>Set up your coach profile</h2>
      <p className="text-secondary" style={{ marginBottom: 22 }}>
        Invite verified for {email} — welcome. Fill in your details to finish setting up your account.
      </p>
      <form onSubmit={handleSubmit}>
        <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Credential (e.g. MS3, PGY-2 IM)" value={credential} onChange={(e) => setCredential(e.target.value)} />
        <textarea className="input" placeholder="Short bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <input className="input" placeholder="Set a password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" disabled={loading || !name || !credential || !password}>
          {loading ? "Setting up..." : "Create my profile"}
        </button>
      </form>
    </div>
  );
}
