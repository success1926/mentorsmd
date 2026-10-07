"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { Icon, ICONS } from "@/components/ui";
import { REPORT_REASONS } from "@/lib/reportReasons";
import { extractLinks, leavingHref } from "@/lib/linkText";

// Safety pieces shared by the message thread and profiles.

// The banner at the top of every conversation (#95).
export function IntegrityBanner() {
  return (
    <div className="integrity-banner" role="note">
      <Icon d={ICONS.shield} size={18} />
      <span>
        <b>Keep it honest and on MentorsMD.</b> Mentors give feedback, never write your essays or applications. Keep payments, calls and files here, so
        your payment stays protected. Never share passwords. <Link href="/community-guidelines" className="link">Community Guidelines</Link>
      </span>
    </div>
  );
}

// Message text with links turned into "You're leaving MentorsMD" links.
export function MessageText({ text }: { text: string }) {
  if (!text) return null;
  const links = extractLinks(text);
  if (!links.length) return <>{text}</>;
  const parts: (string | { link: string })[] = [];
  let rest = text;
  for (const link of links) {
    const i = rest.toLowerCase().indexOf(link.toLowerCase());
    if (i < 0) continue;
    parts.push(rest.slice(0, i), { link: rest.slice(i, i + link.length) });
    rest = rest.slice(i + link.length);
  }
  parts.push(rest);
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <a key={i} className="msg-link" href={leavingHref(p.link)} target="_blank" rel="noopener noreferrer nofollow">
            {p.link}
          </a>
        )
      )}
    </>
  );
}

export type SendWarning = { kind: string; text: string };

// Shown when a message needs a second look before it goes out (#41/#92).
export function SendWarnings({ warnings, onSendAnyway, onEdit, busy }: { warnings: SendWarning[]; onSendAnyway: () => void; onEdit: () => void; busy?: boolean }) {
  return (
    <div className="alert alert-warning stack-sm send-warning" role="alert">
      {warnings.map((w) => (
        <span key={w.kind}>{w.text}</span>
      ))}
      <span className="small">If you send it anyway, our team may review this conversation.</span>
      <div className="row-wrap">
        <button type="button" className="btn btn-sm btn-primary" onClick={onEdit}>Edit message</button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={onSendAnyway}>Send anyway</button>
      </div>
    </div>
  );
}

// "Confirm your email" notice, with a resend button (#37).
export function ConfirmEmailNotice() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function resend() {
    setState("sending");
    const res = await fetch("/api/email/send-verification", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setMsg(d.error || "We couldn't send the email. Try again in a few minutes.");
    } else if (d.alreadyConfirmed) {
      setState("sent");
      setMsg("Your email is already confirmed. Refresh the page and send your message.");
    } else {
      setState("sent");
      setMsg("Sent! Open the link in the email, then come back and send your message.");
    }
  }
  return (
    <div className="alert alert-blue stack-sm send-warning" role="status">
      <span><b>Confirm your email to message mentors.</b> We sent a link to your email when you signed up. It keeps spam accounts out.</span>
      {msg && <span className={state === "error" ? "small" : "small strong"}>{msg}</span>}
      {state !== "sent" && (
        <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={state === "sending"} onClick={resend}>
          {state === "sending" ? "Sending…" : "Resend the link"}
        </button>
      )}
    </div>
  );
}

// Report someone (#44/#96), optionally blocking them too.
export function ReportDialog({
  open,
  onClose,
  subject,
  conversationId,
  messageId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  subject: { id: string; name: string };
  conversationId?: string;
  messageId?: string;
  onDone?: (blocked: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const first = subject.name.split(" ")[0];

  async function submit() {
    if (!reason) return setError("Pick a reason.");
    setBusy(true);
    setError("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectUserId: subject.id, reason, details, conversationId, messageId, block }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Couldn't send the report. Please try again.");
    setDone(true);
    onDone?.(block);
  }

  function close() {
    setReason("");
    setDetails("");
    setBlock(false);
    setError("");
    setDone(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} label={`Report ${subject.name}`}>
      {done ? (
        <div className="stack">
          <h2 style={{ fontSize: 26 }}>Thanks for telling us</h2>
          <p className="text-secondary">Our team reviews every report, usually within a day. {first} isn&apos;t told who reported them.{block ? ` You've also blocked ${first}.` : ""}</p>
          <p className="text-secondary small">If you&apos;re in danger, contact local emergency services first. Read our <Link href="/safety" className="link">safety tips</Link>.</p>
          <button className="btn btn-primary" onClick={close}>Done</button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 26 }}>Report {first}</h2>
          <span className="text-secondary small">{messageId ? "This message is attached to your report." : "Tell us what happened. Reports are private."}</span>
          <div className="stack-sm" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="check" style={{ alignItems: "flex-start" }}>
                <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ marginTop: 2 }} />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Anything else we should know? {reason === "OTHER" ? "" : "(optional)"}</span>
            <textarea className="input" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} style={{ marginBottom: 0 }} />
          </label>
          <label className="check">
            <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
            <span>Also block {first} (neither of you can message the other)</span>
          </label>
          {error && <div role="alert" className="alert alert-danger">{error}</div>}
          <div className="row-wrap">
            <button className="btn btn-danger" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send report"}</button>
            <button className="btn btn-ghost" onClick={close}>Cancel</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export async function setBlocked(userId: string, blocked: boolean) {
  const res = blocked
    ? await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
    : await fetch(`/api/blocks?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "That didn't work");
}
