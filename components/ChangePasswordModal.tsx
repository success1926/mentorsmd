"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Modal } from "@/components/Modal";

function PasswordInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="pw-wrap">
        <input id={id} className="input" type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

// 0 = empty, 1 = weak, 2 = okay, 3 = strong. A hint only; the real rule
// (at least 8 characters) is enforced by the server.
function strength(pw: string) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) return 1;
  return score >= 4 ? 3 : score >= 2 ? 2 : 1;
}
const STRENGTH_LABEL = ["", "Weak", "Okay", "Strong"];

// "Change password" pop-up. Swaps to a confirmation screen when it works.
export function ChangePasswordModal({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setError("");
    setDone(false);
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw.length < 8) return setError("New password must be at least 8 characters.");
    if (newPw !== confirmPw) return setError("The two new passwords don't match.");
    if (newPw === currentPw) return setError("Pick a new password that's different from your current one.");
    setSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      return setError(data.error || "Couldn't change your password.");
    }
    // Changing the password ends older logins, including this one, so
    // log this browser straight back in with the new password.
    await signIn("credentials", { email, password: newPw, redirect: false });
    setSaving(false);
    setDone(true);
  }

  const level = strength(newPw);

  return (
    <Modal open={open} onClose={close} label={done ? "Password changed" : "Change password"}>
      {done ? (
        <div className="stack" style={{ gap: 14, textAlign: "center", alignItems: "center", padding: "8px 0" }}>
          <span className="success-check" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 style={{ fontSize: 26 }}>Your password has been changed</h2>
          <p className="text-secondary">You&apos;re still logged in here. Other devices will be logged out within a few minutes.</p>
          <button className="btn btn-primary" onClick={close} style={{ minWidth: 140 }}>Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="stack" style={{ gap: 4 }}>
          <h2 style={{ fontSize: 26, marginBottom: 12 }}>Change password</h2>
          <PasswordInput id="pw-current" label="Current password" value={currentPw} onChange={setCurrentPw} autoComplete="current-password" />
          <PasswordInput id="pw-new" label="New password" value={newPw} onChange={setNewPw} autoComplete="new-password" />
          {newPw && (
            <div style={{ marginTop: -6, marginBottom: 10 }}>
              <div className="strength" data-level={level} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="field-help">
                {STRENGTH_LABEL[level]}
                {newPw.length < 8 ? ": at least 8 characters" : level < 3 ? ". Longer, with numbers or symbols, is stronger." : ""}
              </span>
            </div>
          )}
          <PasswordInput id="pw-confirm" label="Confirm new password" value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
          {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <button className="btn btn-primary" disabled={saving || !currentPw || !newPw || !confirmPw}>{saving ? "Saving…" : "Change password"}</button>
            <Link href="/forgot-password" className="link small">Forgot your current password?</Link>
          </div>
        </form>
      )}
    </Modal>
  );
}
