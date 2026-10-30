"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

// Admin pop-ups in place of the browser's own confirm() / prompt() /
// alert() boxes. A page calls useAdminDialog(), puts {dialog} somewhere in
// what it renders, then awaits:
//   - confirm({ title, body })            -> true / false
//   - ask({ title, reason: {...} })       -> the typed reason, or null if cancelled
//   - notify(title, body)                 -> resolves once they press OK
// `typeToConfirm` (a person's name, or REMOVE) keeps the button switched
// off until it's typed, for things that are hard to undo. `run` does the
// work inside the pop-up: return an error message to show it on the inline
// error line and keep the pop-up open, or nothing to close it.

export type DialogOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  // null hides Cancel (a plain "OK" message).
  cancelLabel?: string | null;
  danger?: boolean;
  // singleLine: a one-line box (a name) instead of a textarea.
  reason?: { label: string; required?: boolean; placeholder?: string; initial?: string; maxLength?: number; singleLine?: boolean; requiredMessage?: string };
  typeToConfirm?: string;
  run?: (reason: string) => Promise<string | void | undefined>;
};

type Pending = { opts: DialogOptions; resolve: (v: string | null) => void; id: number };

export function useAdminDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const counter = useRef(0);

  const ask = useCallback(
    (opts: DialogOptions) =>
      new Promise<string | null>((resolve) => {
        counter.current += 1;
        setPending({ opts, resolve, id: counter.current });
      }),
    []
  );
  const confirm = useCallback(async (opts: DialogOptions) => (await ask(opts)) !== null, [ask]);
  const notify = useCallback(async (title: string, body?: React.ReactNode) => {
    await ask({ title, body, confirmLabel: "OK", cancelLabel: null });
  }, [ask]);

  const finish = (v: string | null) => {
    pending?.resolve(v);
    setPending(null);
  };
  const dialog = pending ? <AdminDialog key={pending.id} opts={pending.opts} onDone={finish} /> : null;
  return { ask, confirm, notify, dialog };
}

function AdminDialog({ opts, onDone }: { opts: DialogOptions; onDone: (v: string | null) => void }) {
  const [reason, setReason] = useState(opts.reason?.initial ?? "");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const typedOk = !opts.typeToConfirm || typed.trim().toLowerCase() === opts.typeToConfirm.trim().toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !typedOk) return;
    if (opts.reason?.required && !reason.trim()) return setError(opts.reason.requiredMessage ?? "A reason is required.");
    if (opts.run) {
      setBusy(true);
      setError("");
      try {
        const err = await opts.run(reason.trim());
        if (err) {
          setBusy(false);
          return setError(err);
        }
      } catch {
        setBusy(false);
        return setError("That didn't work. Check your connection and try again.");
      }
    }
    onDone(reason.trim());
  }

  const cancel = () => !busy && onDone(null);
  return (
    <Modal open onClose={cancel} label={opts.title} dismissable={!busy}>
      <form className="stack-sm adm-dialog" onSubmit={submit}>
        <h2 className="adm-dialog-title">{opts.title}</h2>
        {opts.body && <div className="text-secondary adm-dialog-body">{opts.body}</div>}
        {opts.reason && (
          <label className="stack-sm" style={{ gap: 4 }}>
            <span className="field-label">{opts.reason.label}</span>
            {opts.reason.singleLine ? (
              <input
                className="input"
                value={reason}
                maxLength={opts.reason.maxLength ?? 200}
                placeholder={opts.reason.placeholder}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError("");
                }}
                style={{ marginBottom: 0 }}
              />
            ) : (
              <textarea
                className="input"
                rows={3}
                value={reason}
                maxLength={opts.reason.maxLength ?? 1000}
                placeholder={opts.reason.placeholder}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError("");
                }}
                style={{ marginBottom: 0 }}
              />
            )}
          </label>
        )}
        {opts.typeToConfirm && (
          <label className="stack-sm" style={{ gap: 4 }}>
            <span className="field-label">
              Type <b>{opts.typeToConfirm}</b> to confirm
            </span>
            <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} style={{ marginBottom: 0 }} />
          </label>
        )}
        {error && <div role="alert" className="alert alert-danger small">{error}</div>}
        <div className="adm-dialog-actions">
          {opts.cancelLabel !== null && (
            <button type="button" className="btn" onClick={cancel} disabled={busy}>
              {opts.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button type="submit" className={`btn ${opts.danger ? "btn-danger" : "btn-primary"}`} disabled={busy || !typedOk}>
            {busy ? "Working…" : opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
