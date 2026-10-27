"use client";

import { useCallback, useEffect, useState } from "react";

// "2-step verification" in Settings (mentors: /dashboard/settings,
// students: /account; API: /api/me/two-step). Mentors always have it and
// choose email codes or an authenticator app; students can turn it on.
export function TwoStepSettings() {
  const [info, setInfo] = useState<{ method: string | null; required: boolean; email: string } | null>(null);
  const [app, setApp] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/me/two-step").then((r) => r.json()).then((d) => (d.error ? null : setInfo(d))).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function post(body: any, done?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/me/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || "Something went wrong" });
      return null;
    }
    if (done) setMsg({ ok: true, text: done });
    return d;
  }

  async function startApp() {
    const d = await post({ action: "start-app" });
    if (d) {
      setApp(d);
      setCode("");
    }
  }
  async function confirmApp(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ action: "confirm-app", code }, "Done. From your next login, enter the code from your authenticator app.")) {
      setApp(null);
      load();
    }
  }
  async function useEmail() {
    const turningOn = !info?.method;
    if (await post({ action: "use-email" }, turningOn ? "2-step verification is on. From your next login we'll email you a code." : "Done. From your next login we'll email you a code.")) load();
  }
  async function turnOff() {
    if (!confirm("Turn off 2-step verification? Logging in will only need your password (or Google).")) return;
    if (await post({ action: "turn-off" }, "2-step verification is off.")) load();
  }
  async function forget() {
    if (!confirm("Forget every device you trusted? Each one will need a code at the next login, this one included.")) return;
    await post({ action: "forget-devices" }, "Done. Every device will need a code at the next login.");
  }

  if (!info) return null;
  const on = !!info.method;

  return (
    <section id="two-step" className="card stack" style={{ gap: 14, scrollMarginTop: 100 }}>
      <div className="stack-sm">
        <h2 style={{ fontSize: 24 }}>2-step verification</h2>
        <span className="text-secondary">
          {info.required
            ? "Mentor accounts need a code at login, as well as the password. You can tick \"Trust this device for 30 days\" when you enter it."
            : "Add a code at login, as well as your password (or Google), so nobody else can get into your account."}
        </span>
      </div>

      <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
        <span>
          {info.method === "TOTP" ? <b>On: authenticator app</b> : info.method === "EMAIL" ? <b>On: code emailed to {info.email}</b> : <b>Off</b>}
        </span>
        <div className="row-wrap" style={{ gap: 8 }}>
          {!on && <button type="button" className="btn btn-sm btn-primary" onClick={useEmail} disabled={busy}>Turn on (email me a code)</button>}
          {info.method !== "TOTP" && !app && <button type="button" className="btn btn-sm" onClick={startApp} disabled={busy}>Use an authenticator app</button>}
          {info.method === "TOTP" && <button type="button" className="btn btn-sm" onClick={useEmail} disabled={busy}>Switch to email codes</button>}
          {on && !info.required && <button type="button" className="btn btn-sm btn-ghost" onClick={turnOff} disabled={busy}>Turn off</button>}
        </div>
      </div>

      {app && (
        <form onSubmit={confirmApp} className="stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <span className="text-secondary">Scan this with Google Authenticator, 1Password, Authy or a similar app, then type the 6-digit code it shows.</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={app.qr} alt="QR code for your authenticator app" width={200} height={200} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />
          <span className="text-muted small">Can&apos;t scan? Enter this key instead: <code style={{ userSelect: "all" }}>{app.secret.match(/.{1,4}/g)?.join(" ")}</code></span>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">6-digit code</span>
            <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} style={{ maxWidth: 200 }} />
          </label>
          <div className="row-wrap" style={{ gap: 8 }}>
            <button className="btn btn-sm btn-primary" disabled={busy || code.replace(/\s/g, "").length !== 6}>Confirm</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setApp(null)}>Cancel</button>
          </div>
        </form>
      )}

      {on && (
        <button type="button" className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={forget} disabled={busy}>
          Forget my trusted devices
        </button>
      )}
      {msg && <div role={msg.ok ? "status" : "alert"} className={`alert ${msg.ok ? "alert-success" : "alert-danger"}`}>{msg.text}</div>}
    </section>
  );
}
