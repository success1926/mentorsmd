"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { AuthShell } from "@/components/AuthShell";
import { logOut } from "@/components/TopNav";
import { useRecaptcha } from "@/components/FormGuards";

// Accepting an invite to the admin team (#114): choose a name and password,
// then log in and set up 2-step verification.
export default function JoinTeamPage() {
  return (
    <Suspense fallback={<div className="page-narrow text-muted">Loading…</div>}>
      <JoinTeam />
    </Suspense>
  );
}

function JoinTeam() {
  const token = useSearchParams()?.get("token") || "";
  const router = useRouter();
  const { data: session, status } = useSession();
  const [invite, setInvite] = useState<{ email: string; role: string; invitedBy: string | null } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const recaptcha = useRecaptcha();

  useEffect(() => {
    if (!token) return setLoadError("This page only works from the invite email.");
    fetch(`/api/team-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) setLoadError(d.error || "This invite link isn't valid any more.");
        else setInvite(d);
      })
      .catch(() => setLoadError("Couldn't load the invite. Refresh the page."));
  }, [token]);

  if (status === "authenticated" && !loading) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>You&apos;re already logged in</h1>
          <p className="text-secondary">You&apos;re logged in as {session?.user?.email}. Log out to accept this team invite.</p>
          <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => logOut(window.location.pathname + window.location.search)}>Log out and continue</button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>Invite not available</h1>
          <p className="text-secondary">{loadError}</p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/team-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, password }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(d.error || "Something went wrong");
    }
    const login = await signIn("credentials", { email: d.email, password, recaptchaToken: (await recaptcha("login")) || "", redirect: false });
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push("/admin/verify");
    router.refresh();
  }

  return (
    <AuthShell title="Welcome to the team." body="You've been invited to help run MentorsMD. Set your password, then set up 2-step verification.">
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: 38 }}>Join the MentorsMD team</h1>
          {invite && (
            <span className="badge badge-brand" style={{ alignSelf: "flex-start" }}>
              {invite.role} · {invite.email}{invite.invitedBy ? ` · invited by ${invite.invitedBy}` : ""}
            </span>
          )}
        </div>
        {!invite ? (
          <span className="text-muted">Loading…</span>
        ) : (
          <form onSubmit={submit} className="stack" style={{ gap: 0 }}>
            <label className="field"><span className="field-label">Your name</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="field"><span className="field-label">Choose a password</span>
              <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <span className="field-help">At least 12 characters. Use one you don&apos;t use anywhere else.</span></label>
            {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 14 }}>{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={loading || !name.trim() || password.length < 12}>
              {loading ? "Setting up…" : "Join the team"}
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
