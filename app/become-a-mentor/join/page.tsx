"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { logOut } from "@/components/TopNav";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

// useSearchParams() requires a Suspense boundary around it for Next.js's
// production build to prerender this page correctly - this wrapper is
// the fix; all the real logic lives in OnboardCoachForm below, unchanged.
export default function OnboardCoachPage() {
  return (
    <Suspense fallback={<div className="page-narrow text-muted">Loading…</div>}>
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
  const { data: session, status } = useSession();

  // Someone is already logged in on this browser (often the admin who sent
  // the invite, testing it). They need to log out to create the mentor account.
  if (status === "authenticated" && code && !loading) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>You&apos;re already logged in</h1>
          <p className="text-secondary">
            You&apos;re logged in as <b>{session?.user?.name || session?.user?.email}</b>
            {session?.user?.email ? ` (${session.user.email})` : ""}. Log out to accept this mentor invite
            {emailFromLink ? ` for ${emailFromLink}` : ""}.
          </p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => logOut(window.location.pathname + window.location.search)}>Log out and continue</button>
          </div>
        </div>
      </div>
    );
  }

  if (!code || !emailFromLink) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>Missing invite link</h1>
          <p className="text-secondary">This page only works from the invite email our team sends you. Open the link in that email to set up your profile.</p>
          <p className="text-secondary">
            Looking for help with your own application? <Link href="/signup" className="link">Create a student account</Link>
          </p>
        </div>
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
    // First stop for a brand-new mentor: photo, search answers, calendar.
    router.push("/account");
    router.refresh();
  }

  return (
    <AuthShell title="Welcome to MentorsMD." body="Our senior team vetted you before sending this invite. Set up your profile, then add a photo, your packages and payouts.">
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: 38 }}>Set up your mentor profile</h1>
          <span className="badge badge-brand" style={{ alignSelf: "flex-start" }}>Invite for {email}</span>
        </div>
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 0 }}>
          <label className="field"><span className="field-label">Full name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span className="field-label">Credential</span>
            <input className="input" placeholder="e.g. MS3, PGY-2 IM" value={credential} onChange={(e) => setCredential(e.target.value)} /></label>
          <label className="field"><span className="field-label">Short bio (optional)</span>
            <textarea className="input" maxLength={3000} placeholder="Where you are in training, what you help with, and what you went through to get in." value={bio} onChange={(e) => setBio(e.target.value)} /></label>
          <label className="field"><span className="field-label">Set a password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="field-help">At least 8 characters.</span></label>
          {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={loading || !name || !credential || password.length < 8}>
            {loading ? "Setting up…" : "Create my profile"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
