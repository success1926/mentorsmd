"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { GROUP_LABELS, renderEmail, sampleValues, validateTemplate, type EmailDef, type EmailVar } from "@/lib/emailTemplates";

type Saved = { subject: string; body: string; updatedAt: string; updatedBy: string | null } | null;

const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// What the editor puts in when a variable is clicked.
function snippet(v: EmailVar, inSubject: boolean) {
  if (inSubject) return `{{${v.name}}}`;
  if (v.kind === "link") return `[Link text]({{${v.name}}})`;
  if (v.kind === "block") return `\n\n{{${v.name}}}\n\n`;
  return `{{${v.name}}}`;
}

// Admin -> Emails -> one email: edit the subject and text, live preview
// with sample data, save, reset to the standard wording, send a test.
export default function EditEmailPage({ params }: { params: { key: string } }) {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [def, setDef] = useState<EmailDef | null>(null);
  const [saved, setSaved] = useState<Saved>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "reset" | "test">("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const load = useCallback(() => {
    fetch(`/api/admin/emails/${encodeURIComponent(params.key)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.def) return setLoadError(d.error || "Couldn't load this email.");
        setDef(d.def);
        setSaved(d.saved);
        setSubject(d.saved?.subject ?? d.def.subject);
        setBody(d.saved?.body ?? d.def.body);
      })
      .catch(() => setLoadError("Couldn't load this email."));
  }, [params.key]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const errors = useMemo(() => (def ? validateTemplate(def, { subject, body }) : []), [def, subject, body]);
  const preview = useMemo(() => (def ? renderEmail(def, { subject, body }, sampleValues(def)) : null), [def, subject, body]);
  const current = saved ?? (def ? { subject: def.subject, body: def.body } : null);
  const dirty = !!current && (subject !== current.subject || body !== current.body);
  const isDefault = !!def && subject.trim() === def.subject && body.trim() === def.body;

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;
  if (loadError) return <div className="page-narrow stack"><Link href="/admin/emails" className="text-secondary">← Emails</Link><div className="alert alert-danger">{loadError}</div></div>;
  if (!def || !preview) return <div className="page text-muted">Loading…</div>;

  function insert(v: EmailVar) {
    const inSubject = lastField.current === "subject";
    if (inSubject && v.kind && v.kind !== "text") return setNotice({ ok: false, text: `{{${v.name}}} can only go in the body.` });
    const el = inSubject ? subjectRef.current : bodyRef.current;
    const value = inSubject ? subject : body;
    const text = snippet(v, inSubject);
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    (inSubject ? setSubject : setBody)(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function save() {
    setBusy("save");
    setNotice(null);
    const res = await fetch(`/api/admin/emails/${def!.key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't save." });
    setNotice({ ok: true, text: isDefault ? "Saved. This email uses the standard wording." : "Saved. Emails sent from now on use this wording." });
    load();
  }

  async function reset() {
    if (!confirm("Go back to the standard wording for this email? Your edited version will be deleted.")) return;
    setBusy("reset");
    setNotice(null);
    const res = await fetch(`/api/admin/emails/${def!.key}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't reset." });
    setNotice({ ok: true, text: "Back to the standard wording." });
    load();
  }

  async function sendTest() {
    setBusy("test");
    setNotice(null);
    const res = await fetch(`/api/admin/emails/${def!.key}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't send the test." });
    setNotice({ ok: true, text: `Test sent to ${d.to}, with sample data and "[Test]" in the subject.` });
  }

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222;margin:16px;}a{color:#5536D6;}</style></head><body>${preview.html}</body></html>`;

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <div className="stack-sm">
        <div className="row-wrap">
          <span className="text-muted">/</span>
          <Link href="/admin/emails" className="text-secondary">Emails</Link>
        </div>
        <h1 className="page-title" style={{ fontSize: "clamp(30px, 3.4vw, 42px)" }}>{def.name}</h1>
        <p className="lede">{def.description}</p>
        <div className="row-wrap">
          <span className="badge">To: {GROUP_LABELS[def.group]}</span>
          {saved ? <span className="badge badge-brand">Edited {fmtWhen(saved.updatedAt)}{saved.updatedBy ? ` by ${saved.updatedBy}` : ""}</span> : <span className="badge">Standard wording</span>}
          {dirty && <span className="badge badge-warning">Unsaved changes</span>}
        </div>
      </div>

      {def.required?.length ? (
        <div className="alert alert-blue">
          This is a security email. You can change the wording, but it must keep {def.required.map((r) => `{{${r}}}`).join(", ")}, or it won&apos;t work.
        </div>
      ) : null}
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="stack">
          <div className="field">
            <label className="field-label" htmlFor="email-subject">Subject</label>
            <input
              id="email-subject"
              ref={subjectRef}
              className="input"
              value={subject}
              maxLength={300}
              onFocus={() => (lastField.current = "subject")}
              onChange={(e) => setSubject(e.target.value.replace(/[\r\n]+/g, " "))}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="email-body">Text</label>
            <textarea
              id="email-body"
              ref={bodyRef}
              className="input"
              style={{ minHeight: 360, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13.5, lineHeight: 1.55 }}
              value={body}
              onFocus={() => (lastField.current = "body")}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {errors.length > 0 && (
            <div className="alert alert-danger stack-sm" style={{ gap: 4 }}>
              {errors.map((e) => <div key={e}>{e}</div>)}
            </div>
          )}

          <div className="row-wrap">
            <button className="btn btn-primary" disabled={!!busy || errors.length > 0 || !dirty} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</button>
            <button className="btn" disabled={!!busy || errors.length > 0} onClick={sendTest}>{busy === "test" ? "Sending…" : "Send test to me"}</button>
            {saved && <button className="btn btn-ghost" disabled={!!busy} onClick={reset}>{busy === "reset" ? "Resetting…" : "Reset to standard wording"}</button>}
            {dirty && <button className="btn btn-ghost" disabled={!!busy} onClick={() => { setSubject(current!.subject); setBody(current!.body); }}>Undo changes</button>}
          </div>
          <span className="text-muted">The test goes only to your own email address, with sample data. Save is what changes real emails.</span>

          <div className="card stack-sm">
            <b>Variables</b>
            <span className="text-secondary" style={{ fontSize: 14 }}>Click one to put it where your cursor is. Each is filled in with the real details when the email is sent.</span>
            <div className="stack-sm" style={{ gap: 6 }}>
              {def.vars.map((v) => (
                <div key={v.name} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                  <button type="button" className="btn btn-sm" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, whiteSpace: "nowrap" }} onClick={() => insert(v)}>
                    {`{{${v.name}}}`}
                  </button>
                  <span className="small" style={{ paddingTop: 6 }}>
                    {v.label}
                    {v.kind === "link" ? " (a link)" : v.kind === "block" ? " (a section: own paragraph)" : ""}
                    {def.required?.includes(v.name) ? <b> · required</b> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-tint stack-sm small">
            <b>Formatting</b>
            <span>Leave a blank line between paragraphs. Press Enter once for a line break.</span>
            <span><code>**bold**</code> makes text bold.</span>
            <span><code>[link text]({"{{orderLink}}"})</code> makes a link. <code>[[Button text]]({"{{orderLink}}"})</code> makes a purple button.</span>
            <span>Start a paragraph with <code>&gt; </code> for grey text, <code>&gt;&gt; </code> for small print, <code>## </code> for large text or <code># </code> for very large text.</span>
            <span>A line with an optional detail (like a due date) is left out when there isn&apos;t one. HTML isn&apos;t allowed: it shows as typed.</span>
          </div>
        </section>

        <section className="stack-sm" style={{ position: "sticky", top: 16 }}>
          <b>Preview with sample data</b>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              <span className="text-muted">Subject</span>
              <div style={{ fontWeight: 600 }}>{preview.subject || <span className="text-muted">(empty)</span>}</div>
            </div>
            <iframe title="Email preview" sandbox="allow-popups" srcDoc={previewDoc} style={{ width: "100%", height: 560, border: 0, background: "#fff" }} />
          </div>
        </section>
      </div>
    </div>
  );
}
