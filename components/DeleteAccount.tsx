"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { logOut } from "@/components/TopNav";
import { Modal } from "@/components/Modal";
import { SettingsSection } from "@/components/SettingsSection";
import { Alert } from "@/components/ui";
import { money } from "@/lib/format";

type Check = { allowed: boolean; blockers: string[]; creditCents: number; hasPassword: boolean };

// "Delete my account" in Settings (students: /account, mentors:
// /dashboard/settings). API: /api/me/delete-account; rules in
// lib/accountDeletion.ts. Mentors who only want to stop taking students
// have "Remove my profile" just above, which can be undone. The button
// opens a pop-up (the same look as the site's other confirm pop-ups) that
// asks for the password and for DELETE to be typed.
export function DeleteAccount() {
  const [check, setCheck] = useState<Check | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me/delete-account").then((r) => r.json()).then((d) => (d.error ? null : setCheck(d))).catch(() => {});
  }, []);

  if (!check) return null;

  return (
    <SettingsSection
      id="delete-account"
      title="Delete my account"
      description={
        <>
          This deletes your profile, your login and your details, right away, and can&apos;t be undone. Payment and order records are kept as the law requires, and messages you sent stay with the people you sent them to, shown as from a deleted user.{" "}
          <Link href="/delete-account" className="link">What&apos;s deleted and what&apos;s kept</Link>
        </>
      }
    >
      {!check.allowed ? (
        <Alert tone="warning" className="stack-sm">
          <b>Before you can delete your account:</b>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {check.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <button type="button" className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
          Delete my account
        </button>
      )}
      {open && <DeleteDialog check={check} onClose={() => setOpen(false)} />}
    </SettingsSection>
  );
}

function DeleteDialog({ check, onClose }: { check: Check; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toUpperCase() === "DELETE" && (!check.hasPassword || password.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/me/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed, password }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(d.error || "That didn't work. Please try again.");
      return;
    }
    logOut("/delete-account?deleted=1");
  }

  return (
    <Modal open onClose={() => !busy && onClose()} label="Delete your account" dismissable={!busy}>
      <form className="stack-sm confirm-dialog" onSubmit={submit}>
        <h2 className="modal-title">Delete your account for good?</h2>
        <div className="text-secondary confirm-dialog-body">
          This can&apos;t be undone.
          {check.creditCents > 0 && (
            <>
              {" "}You have <b>{money(check.creditCents)}</b> of MentorsMD credit. It will be lost and can&apos;t be recovered.
            </>
          )}
        </div>
        {check.hasPassword && (
          <label className="stack-sm" style={{ gap: 4 }}>
            <span className="field-label">Your password</span>
            <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 0 }} />
          </label>
        )}
        <label className="stack-sm" style={{ gap: 4 }}>
          <span className="field-label">
            Type <b>DELETE</b> to confirm
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} style={{ marginBottom: 0 }} />
        </label>
        {error && <div role="alert" className="alert alert-danger small">{error}</div>}
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Keep my account</button>
          <button type="submit" className="btn btn-danger" disabled={!ready || busy}>{busy ? "Deleting…" : "Delete my account"}</button>
        </div>
      </form>
    </Modal>
  );
}
