"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { logOut } from "@/components/TopNav";

// 2-step verification for admins (#116). Every admin login stops here
// until the code is right. First time: choose an authenticator app (scan
// a QR code) or email codes.
export default function AdminVerifyPage() {
  const { data: session, status, update } = useSession();
  const role = (session?.user as any)?.role;
  const router = useRouter();
  const [info, setInfo] = useState<{ method: string | null; email: string } | null>(null);
  const [mode, setMode] = useState<"TOTP" | "EMAIL" | null>(null);
  const [app, setApp] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role === "ADMIN") {
      router.replace("/admin");
      return;
    }
    if (role !== "ADMIN_2FA") return;
    fetch("/api/admin/2fa")
      .then((r) => r.json())
      .then((d) => {
        setInfo(d);
        if (d.method) setMode(d.method);
      })
      .catch(() => setError("Couldn't load. Refresh the page."));
  }, [role, router]);

  async function post(body: any) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Something went wrong");
      return null;
    }
    return d;
  }

  async function chooseApp() {
    setMode("TOTP");
    const d = await post({ action: "start-app" });
    if (d) setApp(d);
  }

  async function sendCode() {
    setMode("EMAIL");
    const d = await post({ action: "send-code" });
    if (d) setSent(true);
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const d = await post({ action: "verify", method: mode, code });
    if (!d?.ticket) return;
    setBusy(true);
    await update({ mfaTicket: d.ticket });
    // Reload so every part of the page sees the verified session.
    window.location.href = "/admin";
  }

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (role !== "ADMIN_2FA" && role !== "ADMIN") {
    return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  }

  const firstTime = info && !info.method;
  const codeForm = (
    <form onSubmit={verify} className="stack-sm">
      <label className="field" style={{ marginBottom: 0 }}>
        <span className="field-label">6-digit code</span>
        <input
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
          style={{ fontSize: 22, letterSpacing: 6, maxWidth: 220 }}
        />
      </label>
      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy || code.replace(/\s/g, "").length !== 6}>
        {busy ? "Checking…" : "Verify"}
      </button>
    </form>
  );

  return (
    <div className="page-narrow">
      <div className="card-narrow stack">
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: 34 }}>{firstTime ? "Set up 2-step verification" : "2-step verification"}</h1>
          <p className="text-secondary">
            {firstTime
              ? "Admin accounts need a second step at every login. Choose how you'd like to get your codes."
              : "Enter the code to finish logging in."}
          </p>
        </div>
        {!info && !error && <span className="text-muted">Loading…</span>}

        {info && firstTime && !mode && (
          <div className="stack-sm">
            <button className="btn btn-primary" onClick={chooseApp} disabled={busy}>Use an authenticator app (recommended)</button>
            <button className="btn" onClick={sendCode} disabled={busy}>Email me a code each time ({info.email})</button>
          </div>
        )}

        {mode === "TOTP" && firstTime && app && (
          <div className="stack-sm">
            <span className="text-secondary">Scan this with Google Authenticator, 1Password, Authy or a similar app, then type the 6-digit code it shows.</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={app.qr} alt="QR code for your authenticator app" width={220} height={220} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />
            <span className="text-muted small">Can&apos;t scan? Enter this key instead: <code style={{ userSelect: "all" }}>{app.secret.match(/.{1,4}/g)?.join(" ")}</code></span>
            {codeForm}
          </div>
        )}

        {mode === "TOTP" && !firstTime && (
          <div className="stack-sm">
            <span className="text-secondary">Open your authenticator app and enter the code for MentorsMD.</span>
            {codeForm}
            <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>No phone? Email me a code instead</button>
          </div>
        )}

        {mode === "EMAIL" && (
          <div className="stack-sm">
            {sent ? (
              <span className="text-secondary">We emailed a code to {info?.email}. It expires in 10 minutes.</span>
            ) : (
              <button className="btn" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>Email me a code</button>
            )}
            {sent && codeForm}
            {sent && <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>Send a new code</button>}
          </div>
        )}

        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        {firstTime && mode && (
          <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => { setMode(null); setApp(null); setSent(false); setCode(""); setError(""); }}>
            Choose a different way
          </button>
        )}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => logOut("/")}>Log out</button>
      </div>
    </div>
  );
}
