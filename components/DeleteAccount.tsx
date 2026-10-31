"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logOut } from "@/components/TopNav";

type Check = { allowed: boolean; blockers: string[]; creditCents: number; hasPassword: boolean };

// "Delete my account" in Settings (students: /account, mentors:
// /dashboard/settings). API: /api/me/delete-account; rules in
// lib/accountDeletion.ts. Mentors who only want to stop taking students
// have "Remove my profile" just above, which can be undone.
export function DeleteAccount() {
  const [check, setCheck] = useState<Check | null>(null);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/me/delete-account").then((r) => r.json()).then((d) => (d.error ? null : setCheck(d))).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm, password }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(d.error || "That didn't work. Please try again.");
      return;
    }
    logOut("/delete-account?deleted=1");
  }

  if (!check) return null;
  const ready = confirm.trim().toUpperCase() === "DELETE" && (!check.hasPassword || password.length > 0);

  return (
    <section id="delete-account" className="card stack" style={{ gap: 14, scrollMarginTop: 100 }}>
      <h2 style={{ fontSize: 24 }}>Delete my account</h2>
      <span className="text-secondary">
        This deletes your profile, your login and your details, right away, and can&apos;t be undone. Payment and order records are kept as the law requires, and messages you sent stay with the people you sent them to, shown as from a deleted user.{" "}
        <Link href="/delete-account" className="link">What&apos;s deleted and what&apos;s kept</Link>
      </span>

      {!check.allowed ? (
        <div className="alert alert-warning stack-sm">
          <b>Before you can delete your account:</b>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {check.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : !open ? (
        <button type="button" className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
          Delete my account
        </button>
      ) : (
        <form className="alert alert-danger stack" onSubmit={submit}>
          <b>Delete your account for good?</b>
          {check.creditCents > 0 && (
            <span>
              You have <b>${(check.creditCents / 100).toFixed(2)}</b> of MentorsMD credit. It will be lost and can&apos;t be recovered.
            </span>
          )}
          {check.hasPassword && (
            <label className="stack-sm">
              <span>Your password</span>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 0, background: "#fff" }} />
            </label>
          )}
          <label className="stack-sm">
            <span>Type DELETE to confirm</span>
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" style={{ marginBottom: 0, background: "#fff" }} />
          </label>
          {error && <span role="alert">{error}</span>}
          <div className="row-wrap">
            <button type="submit" className="btn btn-danger" disabled={!ready || busy}>{busy ? "Deleting…" : "Delete my account"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setError(""); }}>Keep my account</button>
          </div>
        </form>
      )}
    </section>
  );
}
