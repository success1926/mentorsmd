"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AdminGuard } from "@/components/admin/AdminNav";
import { LegalBody } from "@/components/LegalBody";
import { useConfirm } from "@/components/ConfirmDialog";
import { LEGAL_INFO, LEGAL_KINDS } from "@/lib/legalKinds";
import { RowTitle } from "@/components/admin/RowTitle";
import { ShowMore } from "@/components/admin/ShowMore";
import { Collapsible, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { fmtDateTime, fmtDay } from "@/lib/format";

// Admin -> Legal (#99, #102, #103): edit and publish versions of each
// legal document, and see who accepted what.
export default function AdminLegalPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [kinds, setKinds] = useState<any[] | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/legal").then((r) => r.json()).then((d) => setKinds(d.kinds || [])).catch(() => setKinds([]));
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const guard = AdminGuard({ status, isAdmin });
  if (guard) return guard;

  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <PageHeader title="Legal" lede="Terms, Privacy, the Mentor Agreement, Community Guidelines and the Parental Consent form." />
      <div className="card card-tint stack-sm small">
        <b>How this works</b>
        <span className="text-secondary">
          Until version 1 of a document is published, the site shows its built-in placeholder text and nobody is asked to accept anything new.
          Publishing version 1 switches the requirement on: everyone who needs that document sees a screen asking them to accept it before they continue.
          Later versions can be a <b>minor change</b> (typos, contact details: earlier acceptances still count) or <b>must re-accept</b> (everyone sees the screen again).
          Published versions can&apos;t be edited or deleted. Have a lawyer review the text before publishing.
        </span>
      </div>
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      {kinds === null && <LoadingBlock lines={3} cards={2} />}
      {kinds?.map((k) => <DocCard key={k.kind} k={k} onChanged={load} setNotice={setNotice} />)}
      <Acceptances />
    </div>
  );
}

function DocCard({ k, onChanged, setNotice }: { k: any; onChanged: () => void; setNotice: (n: { ok: boolean; text: string } | null) => void }) {
  const published = k.versions.filter((v: any) => v.status === "PUBLISHED");
  const latest = published[0];
  const draft = k.versions.find((v: any) => v.status === "DRAFT");
  const [busy, setBusy] = useState(false);

  async function startDraft() {
    setBusy(true);
    const res = await fetch("/api/admin/legal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: k.kind }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't start a draft" });
    onChanged();
  }

  return (
    <section className="card stack" id={k.kind.toLowerCase()}>
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <h2 className="block-title">{k.label}</h2>
          <span className="text-muted">For: {k.who} · <Link href={k.path} target="_blank" className="link">View the public page</Link></span>
        </div>
        {latest ? (
          <span className="badge badge-success">Version {latest.version} live since {fmtDay(latest.publishedAt)}</span>
        ) : (
          <span className="badge badge-warning">Built-in placeholder text (no version published)</span>
        )}
      </div>
      {latest && (
        <span className="text-secondary small">
          {latest.acceptances} acceptance{latest.acceptances === 1 ? "" : "s"} of version {latest.version}
          {k.builtInAcceptances ? ` · ${k.builtInAcceptances} of the built-in text` : ""}
        </span>
      )}
      {!latest && k.builtInAcceptances > 0 && <span className="text-secondary small">{k.builtInAcceptances} acceptance{k.builtInAcceptances === 1 ? "" : "s"} of the built-in text</span>}

      {draft ? (
        <DraftEditor key={draft.id} draft={draft} isFirst={!latest} onChanged={onChanged} setNotice={setNotice} label={k.label} />
      ) : (
        <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={startDraft}>
          {latest ? `Write version ${latest.version + 1}` : "Write version 1"}
        </button>
      )}

      {published.length > 0 && (
        <Collapsible title="Version history" count={published.length} bodyClassName="adm-collapse-list">
          {published.map((v: any) => (
            <Collapsible
              key={v.id}
              variant="row"
              className="adm-row"
              title={<RowTitle title={`Version ${v.version}: ${v.title}`} sub={`Published ${fmtDateTime(v.publishedAt)}${v.createdBy?.name ? ` · drafted by ${v.createdBy.name}` : ""} · ${v.acceptances} accepted`} />}
              meta={<span className={`badge ${v.changeType === "MAJOR" ? "badge-pink" : ""}`}>{v.changeType === "MAJOR" ? "Must re-accept" : "Minor change"}</span>}
            >
              {v.changeNote && <span className="small text-secondary"><b>What changed:</b> {v.changeNote}</span>}
              <div className="adm-legal-body">
                <LegalBody body={v.body} />
              </div>
            </Collapsible>
          ))}
        </Collapsible>
      )}
    </section>
  );
}

function DraftEditor({ draft, isFirst, onChanged, setNotice, label }: { draft: any; isFirst: boolean; onChanged: () => void; setNotice: (n: { ok: boolean; text: string } | null) => void; label: string }) {
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [changeType, setChangeType] = useState<"MAJOR" | "MINOR">(draft.changeType === "MINOR" ? "MINOR" : "MAJOR");
  const [changeNote, setChangeNote] = useState(draft.changeNote || "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { confirm, dialog } = useConfirm();

  async function save(publish: boolean) {
    if (publish) {
      const who = isFirst || changeType === "MAJOR" ? "Everyone it applies to will have to accept it before they can continue." : "It's a minor change, so nobody has to accept it again.";
      if (!(await confirm({ title: `Publish this as the new ${label}?`, body: `${who} Published versions can't be changed.`, confirmLabel: "Publish" }))) return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/legal/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, changeType, changeNote, ...(publish ? { action: "publish" } : {}) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't save" });
    if (publish) {
      setNotice({ ok: true, text: `${label} version ${d.doc.version} is live.` });
      onChanged();
    } else {
      setMsg({ ok: true, text: "Draft saved." });
    }
  }

  async function discard() {
    if (!(await confirm({ title: "Delete this draft?", body: "The published version stays as it is.", confirmLabel: "Delete draft", danger: true }))) return;
    const res = await fetch(`/api/admin/legal/${draft.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  return (
    <div className="card card-tint stack-sm" style={{ padding: 18 }}>
      {dialog}
      <b>Draft{draft.updatedAt ? ` (last saved ${fmtDateTime(draft.updatedAt)})` : ""}</b>
      <label className="field" style={{ marginBottom: 6 }}>
        <span className="field-label">Title</span>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </label>
      <div className="tabs adm-tabs-inline" role="tablist" aria-label="Draft view">
        <button type="button" role="tab" className="tab" aria-selected={!preview} onClick={() => setPreview(false)}>Edit</button>
        <button type="button" role="tab" className="tab" aria-selected={preview} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview ? (
        <div style={{ background: "var(--surface)", borderRadius: 12, padding: 16, maxHeight: 520, overflowY: "auto" }}>
          <LegalBody body={body} />
        </div>
      ) : (
        <label className="field" style={{ marginBottom: 6 }}>
          <span className="field-label">Text</span>
          <textarea
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ minHeight: 360, fontFamily: "ui-monospace, monospace", fontSize: 13.5, lineHeight: 1.5 }}
          />
          <span className="field-help">Start a line with &quot;## &quot; for a heading and &quot;- &quot; for a bullet point. Leave a blank line between paragraphs.</span>
        </label>
      )}
      {!isFirst && (
        <div className="field" style={{ marginBottom: 6 }}>
          <span className="field-label">What kind of change is this?</span>
          <div className="seg">
            <button type="button" className="seg-opt" aria-pressed={changeType === "MINOR"} onClick={() => setChangeType("MINOR")}>Minor change (no re-accept)</button>
            <button type="button" className="seg-opt" aria-pressed={changeType === "MAJOR"} onClick={() => setChangeType("MAJOR")}>Everyone must accept again</button>
          </div>
        </div>
      )}
      {isFirst && <span className="text-secondary small">This will be version 1: once published, everyone it applies to is asked to accept it.</span>}
      <label className="field" style={{ marginBottom: 6 }}>
        <span className="field-label">What changed (optional, shown on the accept screen)</span>
        <input className="input" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} maxLength={2000} placeholder="e.g. New section on refunds for cancelled calls" />
      </label>
      {msg && <div role="status" className={`alert ${msg.ok ? "alert-success" : "alert-danger"}`}>{msg.text}</div>}
      <div className="row-wrap">
        <button type="button" className="btn" disabled={busy} onClick={() => save(false)}>Save draft</button>
        <button type="button" className="btn btn-primary" disabled={busy || !title.trim() || body.trim().length < 50} onClick={() => save(true)}>Publish</button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} disabled={busy} onClick={discard}>Delete draft</button>
      </div>
    </div>
  );
}

function Acceptances() {
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const params = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(extra);
    if (kind) p.set("kind", kind);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [kind, q]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/legal/acceptances?${params()}`)
        .then((r) => r.json())
        .then((d) => {
          setRows(d.rows || []);
          setHasMore(!!d.hasMore);
        })
        .catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [params]);

  async function more() {
    const last = rows?.[rows.length - 1];
    if (!last) return;
    const d = await fetch(`/api/admin/legal/acceptances?${params({ before: last.createdAt })}`).then((r) => r.json()).catch(() => null);
    if (!d) return;
    setRows((r) => [...(r || []), ...(d.rows || [])]);
    setHasMore(!!d.hasMore);
  }

  return (
    <section className="stack-sm" id="acceptances">
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <h2 className="block-title">Acceptance records</h2>
        <a className="btn btn-sm" href={`/api/admin/legal/acceptances?${params({ format: "csv" })}`}>Download CSV</a>
      </div>
      <div className="row-wrap">
        <select className="input" style={{ marginBottom: 0, maxWidth: 260 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document">
          <option value="">All documents</option>
          {LEGAL_KINDS.map((k) => <option key={k} value={k}>{LEGAL_INFO[k].label}</option>)}
        </select>
        <input className="input grow" type="search" style={{ marginBottom: 0 }} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search acceptances" />
      </div>
      {rows === null && <LoadingBlock lines={4} title={false} />}
      {rows?.length === 0 && <EmptyState>No records yet.</EmptyState>}
      {!!rows?.length && (
      <div className="card" style={{ padding: "4px 20px" }}>
        {rows.map((r) => (
          <div key={r.id} className="list-row small" style={{ flexWrap: "wrap", gap: 10 }}>
            <span className="text-muted nowrap">{fmtDateTime(r.createdAt)}</span>
            <span className="badge badge-brand">{LEGAL_INFO[r.kind as keyof typeof LEGAL_INFO]?.label || r.kind} {r.version === 0 ? "(built-in)" : `v${r.version}`}</span>
            <span className="grow" style={{ minWidth: 180 }}>
              <b>{r.signerName ? `${r.signerName} (parent of ${r.user?.name || "a student"})` : r.user?.name || "Deleted account"}</b> · {r.email}
            </span>
            <span className="text-muted" title={r.userAgent || ""}>{r.context.toLowerCase().replace(/_/g, " ")} · {r.ip || "no IP"}</span>
          </div>
        ))}
        {hasMore && <ShowMore onClick={more} />}
      </div>
      )}
    </section>
  );
}
