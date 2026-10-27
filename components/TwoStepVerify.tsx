"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { logOut } from "@/components/TopNav";
import { isPending2faRole } from "@/lib/sessionRules";

// The 2-step code step at login (/admin/verify for admins, /two-step for
// mentors and students; rules in lib/mfa.ts). Email codes are the default:
// someone who hasn't set up an authenticator app gets a code emailed as
// soon as the page opens, and can switch to an app instead. "Trust this
// device for 30 days" skips the step on this browser after that.
export function TwoStepVerify({ next }: { next: string }) {
  const { data: session, status, update } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const pending = isPending2faRole(role);
  const router = useRouter();
  const [info, setInfo] = useState<{ method: string | null; email: string; role: string } | null>(null);
  const [mode, setMode] = useState<"TOTP" | "EMAIL" | null>(null);
  const [app, setApp] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoSent = useRef(false);

  useEffect(() => {
    // Already done (or never needed): carry on.
    if (status === "authenticated" && !pending) {
      router.replace(next);
      return;
    }
    if (!pending) return;
    fetch("/api/two-step")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setError(d.error);
        setInfo(d);
        setMode(d.method === "TOTP" ? "TOTP" : "EMAIL");
      })
      .catch(() => setError("Couldn't load. Refresh the page."));
  }, [status, pending, next, router]);

  async function post(body: any) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Something went wrong");
      return null;
    }
    return d;
  }

  async function sendCode() {
    setMode("EMAIL");
    setApp(null);
    setNote("");
    const d = await post({ action: "send-code" });
    if (!d) return;
    // sent: false means a code went out under 30 seconds ago (still good).
    if (sent && d.sent === false) setNote("We just sent a code. Give it a minute, and check your spam folder.");
    setSent(true);
  }

  // Email codes: send the first one straight away.
  useEffect(() => {
    if (info && info.method !== "TOTP" && !autoSent.current) {
      autoSent.current = true;
      sendCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  async function chooseApp() {
    setMode("TOTP");
    setCode("");
    const d = await post({ action: "start-app" });
    if (d) setApp(d);
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const d = await post({ action: "verify", method: mode, code, trust });
    if (!d?.ticket) return;
    setBusy(true);
    await update({ mfaTicket: d.ticket });
    // Reload so every part of the page sees the verified session.
    window.location.href = next;
  }

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!pending) return <div className="page text-muted">Loading…</div>;

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
      <label className="row small" style={{ gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
        <span>Trust this device for 30 days (don&apos;t tick this on a shared computer)</span>
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
          <h1 className="page-title" style={{ fontSize: 34 }}>2-step verification</h1>
          <p className="text-secondary">
            {info?.role === "ADMIN"
              ? "Admin accounts need a second step at every login."
              : info?.role === "SELLER"
                ? "Mentor accounts need a second step when logging in, to keep your students and payouts safe."
                : "You turned on 2-step verification, so we need a code to finish logging in."}
          </p>
        </div>
        {!info && !error && <span className="text-muted">Loading…</span>}

        {mode === "TOTP" && firstTime && app && (
          <div className="stack-sm">
            <span className="text-secondary">Scan this with Google Authenticator, 1Password, Authy or a similar app, then type the 6-digit code it shows.</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={app.qr} alt="QR code for your authenticator app" width={220} height={220} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />
            <span className="text-muted small">Can&apos;t scan? Enter this key instead: <code style={{ userSelect: "all" }}>{app.secret.match(/.{1,4}/g)?.join(" ")}</code></span>
            {codeForm}
            <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>Email me a code instead</button>
          </div>
        )}

        {mode === "TOTP" && !firstTime && info && (
          <div className="stack-sm">
            <span className="text-secondary">Open your authenticator app and enter the code for MentorsMD.</span>
            {codeForm}
            <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>No phone? Email me a code instead</button>
          </div>
        )}

        {mode === "EMAIL" && info && (
          <div className="stack-sm">
            {sent ? (
              <span className="text-secondary">We emailed a code to {info.email}. It expires in 10 minutes.</span>
            ) : (
              <button className="btn" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>Email me a code</button>
            )}
            {sent && codeForm}
            {sent && <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={sendCode} disabled={busy}>Send a new code</button>}
            {note && <span role="status" className="text-muted small">{note}</span>}
            {firstTime && (
              <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={chooseApp} disabled={busy}>Use an authenticator app instead</button>
            )}
          </div>
        )}

        {error && <div role="alert" className="alert alert-danger">{error}</div>}
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => logOut("/")}>Log out</button>
      </div>
    </div>
  );
}
