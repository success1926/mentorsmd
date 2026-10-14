"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminCan } from "@/components/admin/AdminShell";
import {
  APPLICATION_STATUS_LABEL,
  LEAD_KIND_LABEL,
  LEAD_STATUSES,
  NOTE_MAX,
  contactTopicLabel,
  leadStatusLabel,
  type LeadKind,
} from "@/lib/leadOptions";
import { labelFor, SERVICES } from "@/lib/options";

// Admin -> Leads: mentor applications, contact messages and waitlist
// signups. Each lead has a stage (New / In progress / Done), who on the
// team it's assigned to, and internal notes. Mentor applications keep
// their Invite / Decline buttons; their stage follows from those (see
// applicationStage in lib/leadOptions.ts).

type Note = { id: string; body: string; createdAt: string; author: { id: string; name: string } | null };
type Row = {
  id: string;
  kind: LeadKind;
  stage: string;
  status: string;
  email: string;
  name: string | null;
  createdAt: string;
  assignedToId: string | null;
  assignedTo: { id: string; name: string } | null;
  notes: Note[];
  // applications
  phone?: string;
  medicalSchool?: string;
  residency?: string | null;
  blurb?: string;
  resumeUrl?: string;
  resumeName?: string;
  decidedAt?: string | null;
  // contact / waitlist
  topic?: string | null;
  message?: string | null;
  service?: string | null;
  applyYear?: string | null;
  source?: string | null;
  notifiedAt?: string | null;
};
type Data = { rows: Row[]; admins: { id: string; name: string }[]; me: string; counts: Record<LeadKind, number>; toNotify: number };

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const isKind = (v: string | null): v is LeadKind => v === "APPLICATION" || v === "CONTACT" || v === "WAITLIST";
const stageBadge: Record<string, string> = { NEW: "badge badge-brand", IN_PROGRESS: "badge badge-warning", DONE: "badge" };

export function LeadsInbox() {
  const canApps = useAdminCan("applications");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const kinds: LeadKind[] = canApps ? ["APPLICATION", "CONTACT", "WAITLIST"] : ["CONTACT", "WAITLIST"];
  const asked = sp.get("tab");
  const tab: LeadKind = isKind(asked) && kinds.includes(asked) ? asked : kinds[0];
  const openId = sp.get("open");

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [stage, setStage] = useState("");
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setError("");
    fetch(`/api/admin/leads?kind=${tab}`)
      .then((r) => r.json())
      .then((d) => (d.rows ? setData(d) : setError(d.error || "Couldn't load the leads.")))
      .catch(() => setError("Couldn't load the leads."));
  }, [tab]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  function pickTab(k: LeadKind) {
    setNotice(null);
    router.replace(`${pathname}?tab=${k}`, { scroll: false });
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows || []).filter((r) => {
      if (stage && r.stage !== stage) return false;
      if (who === "me" && r.assignedToId !== data?.me) return false;
      if (who === "none" && r.assignedToId) return false;
      if (who && who !== "me" && who !== "none" && r.assignedToId !== who) return false;
      if (needle && ![r.name, r.email, r.message, r.medicalSchool].some((v) => v && v.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [data, stage, who, q]);

  // Update one row in place after a change, without reloading the list.
  const patchRow = (id: string, change: Partial<Row>) =>
    setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...change } : r)) } : d));

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <div className="stack-sm">
        <h1 className="page-title">Leads</h1>
        <p className="lede">Mentor applications, messages from the Contact page and waitlist signups. Assign each one to someone on the team, keep notes, and mark it done.</p>
      </div>

      <div className="tabs" role="tablist">
        {kinds.map((k) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => pickTab(k)}>
            {LEAD_KIND_LABEL[k]}
            {data && data.counts[k] > 0 && <span className="tab-count" title="New">{data.counts[k]} new</span>}
          </button>
        ))}
      </div>

      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      {error && <div role="alert" className="alert alert-danger">{error}</div>}

      {tab === "WAITLIST" && data && <NotifyWaitlist toNotify={data.toNotify} onDone={load} setNotice={setNotice} />}

      <div className="ins-filters">
        <div className="field">
          <label className="field-label" htmlFor="lead-stage">Status</label>
          <select id="lead-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All</option>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="lead-who">Assigned to</label>
          <select id="lead-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="none">Nobody yet</option>
            {(data?.admins || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="lead-q">Search</label>
          <input id="lead-q" className="input" type="search" placeholder="Name, email or text" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <a className="btn btn-sm" href={`/api/admin/leads/export?kind=${tab}`} style={{ marginLeft: "auto" }}>Download CSV</a>
      </div>

      {tab === "APPLICATION" && (
        <p className="text-muted small">Pending applications are New until someone is assigned (then In progress). Invite or Decline marks them Done; Decline sends no email.</p>
      )}

      <div className="card" style={{ padding: "4px 20px" }}>
        {!data && !error && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {data && rows.length === 0 && <p className="text-muted" style={{ padding: 12 }}>Nothing here{stage || who || q ? " with these filters" : " yet"}.</p>}
        {data &&
          rows.map((r) => (
            <LeadRow key={r.id} row={r} admins={data.admins} defaultOpen={r.id === openId} onChange={(c) => patchRow(r.id, c)} reload={load} setNotice={setNotice} />
          ))}
      </div>
      {data && data.rows.length >= 500 && <p className="text-muted small">Showing the newest 500. Download the CSV for the full list.</p>}
    </div>
  );
}

function LeadRow({
  row: r,
  admins,
  defaultOpen,
  onChange,
  reload,
  setNotice,
}: {
  row: Row;
  admins: { id: string; name: string }[];
  defaultOpen: boolean;
  onChange: (c: Partial<Row>) => void;
  reload: () => void;
  setNotice: (n: { ok: boolean; text: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const title = r.kind === "WAITLIST" ? r.email : r.name || r.email;
  const sub =
    r.kind === "APPLICATION"
      ? `${r.medicalSchool}${r.residency ? ` · ${r.residency}` : ""} · applied ${fmtDay(r.createdAt)}`
      : r.kind === "CONTACT"
        ? `${contactTopicLabel(r.topic)} · ${fmtDay(r.createdAt)}`
        : [r.service ? labelFor(SERVICES, r.service) : null, r.applyYear ? `applying ${r.applyYear}` : null, `signed up ${fmtDay(r.createdAt)}`].filter(Boolean).join(" · ");

  async function update(change: { status?: string; assignedToId?: string | null }) {
    setBusy(true);
    const res = await fetch(`/api/admin/leads/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: r.kind, ...change }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "That didn't work." });
    if (r.kind === "APPLICATION") reload();
    else {
      const assignedTo = change.assignedToId !== undefined ? admins.find((a) => a.id === change.assignedToId) || null : r.assignedTo;
      onChange({ ...change, ...(change.status ? { stage: change.status } : {}), assignedTo });
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/leads/${r.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: r.kind, body: note }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't save the note." });
    setNote("");
    onChange({ notes: [...r.notes, d.note] });
  }

  // The existing mentor application actions (same API as before).
  async function appAction(action: "invite" | "decline" | "reopen") {
    if (action === "invite" && !confirm(`Send a mentor invite to ${r.email}?`)) return;
    if (action === "decline" && !confirm(`Decline ${r.name}'s application? No email is sent.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/applications/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setNotice({ ok: false, text: d.error || "That didn't work." });
    else if (action === "invite") {
      setNotice(d.emailSent === false ? { ok: false, text: d.warning || "Invite created but the email failed. Use Resend on the Mentors page." } : { ok: true, text: `Invite sent to ${r.email}.` });
    }
    reload();
  }

  return (
    <details className="list-row" style={{ display: "block" }} open={defaultOpen || undefined}>
      <summary className="between" style={{ cursor: "pointer", flexWrap: "wrap", gap: 8 }}>
        <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
          <b style={{ fontSize: 15, overflowWrap: "anywhere" }}>{title}</b>
          <span className="text-muted">{sub}</span>
        </span>
        <span className="row-wrap" style={{ gap: 6 }}>
          {r.assignedTo && <span className="badge">{r.assignedTo.name}</span>}
          {r.notes.length > 0 && <span className="badge">{r.notes.length} note{r.notes.length === 1 ? "" : "s"}</span>}
          {r.kind === "APPLICATION" && r.status !== "PENDING" && (
            <span className={r.status === "INVITED" ? "badge badge-success" : "badge"}>
              {APPLICATION_STATUS_LABEL[r.status]}{r.decidedAt ? ` ${fmtDay(r.decidedAt)}` : ""}
            </span>
          )}
          {r.kind === "WAITLIST" && r.notifiedAt && <span className="badge badge-success">Emailed {fmtDay(r.notifiedAt)}</span>}
          <span className={stageBadge[r.stage] || "badge"}>{leadStatusLabel(r.stage)}</span>
        </span>
      </summary>

      <div className="stack-sm small" style={{ padding: "10px 0 6px", gap: 12 }}>
        <span>
          <b>Email:</b> <a className="link" href={`mailto:${r.email}`}>{r.email}</a>
          {r.phone && <> · <b>Phone:</b> {r.phone}</>}
        </span>
        {r.kind === "APPLICATION" && r.blurb && <p className="text-secondary" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.blurb}</p>}
        {r.kind === "CONTACT" && r.message && <p className="text-secondary" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, overflowWrap: "anywhere" }}>{r.message}</p>}
        {r.kind === "WAITLIST" && (
          <span className="text-secondary">
            Needs help with: {r.service ? labelFor(SERVICES, r.service) : "not sure yet"} · Applying in: {r.applyYear || "not sure yet"}
            {r.source ? ` · Signed up on the ${r.source} page` : ""}
          </span>
        )}

        {r.kind === "APPLICATION" && (
          <div className="row-wrap">
            <a href={`/api/admin/applications/${r.id}/resume`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Download resume</a>
            {r.status !== "INVITED" && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => appAction("invite")}>Invite</button>}
            {r.status === "PENDING" && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => appAction("decline")}>Decline</button>}
            {r.status === "DECLINED" && <button className="btn btn-sm" disabled={busy} onClick={() => appAction("reopen")}>Move back to pending</button>}
          </div>
        )}

        <div className="row-wrap" style={{ gap: 16, alignItems: "flex-end" }}>
          {r.kind !== "APPLICATION" && (
            <label className="field" style={{ margin: 0, minWidth: 160 }}>
              <span className="field-label">Status</span>
              <select className="input" value={r.status} disabled={busy} onChange={(e) => update({ status: e.target.value })}>
                {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
          <label className="field" style={{ margin: 0, minWidth: 200 }}>
            <span className="field-label">Assigned to</span>
            <select className="input" value={r.assignedToId || ""} disabled={busy} onChange={(e) => update({ assignedToId: e.target.value || null })}>
              <option value="">Nobody yet</option>
              {r.assignedTo && !admins.some((a) => a.id === r.assignedTo!.id) && <option value={r.assignedTo.id}>{r.assignedTo.name} (no longer on the team)</option>}
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>

        <div className="stack-sm" style={{ gap: 8 }}>
          <b>Internal notes</b>
          {r.notes.length === 0 && <span className="text-muted">No notes yet. Only the admin team sees these.</span>}
          {r.notes.map((n) => (
            <div key={n.id} className="card card-tint" style={{ padding: "10px 14px" }}>
              <span className="text-muted">{n.author?.name || "Former team member"} · {fmtWhen(n.createdAt)}</span>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, marginTop: 4, overflowWrap: "anywhere" }}>{n.body}</p>
            </div>
          ))}
          <textarea className="input" rows={2} maxLength={NOTE_MAX} placeholder="Add a note for the team" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
          <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy || !note.trim()} onClick={addNote}>Add note</button>
        </div>
      </div>
    </details>
  );
}

// "Email everyone on the waitlist": confirm with the count, then send in
// small batches (one request each) until everyone has had it.
function NotifyWaitlist({ toNotify, onDone, setNotice }: { toNotify: number; onDone: () => void; setNotice: (n: { ok: boolean; text: string } | null) => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "sending">("idle");
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });

  async function run() {
    setStep("sending");
    setNotice(null);
    let sent = 0;
    let failed = 0;
    let after: string | null = null;
    try {
      for (let guard = 0; guard < 2000; guard++) {
        const res = await fetch("/api/admin/leads/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ after }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Sending stopped.");
        sent += d.sent;
        failed += d.failed;
        after = d.last;
        setProgress({ sent, failed });
        if (d.done) break;
      }
      setNotice({
        ok: failed === 0,
        text: `Emailed ${sent} ${sent === 1 ? "person" : "people"} on the waitlist.${failed ? ` ${failed} couldn't be sent (see Admin → Email log); press the button again later to retry them.` : ""}`,
      });
    } catch (err) {
      setNotice({ ok: false, text: `${err instanceof Error ? err.message : "Sending stopped."} ${sent} sent so far; press the button again to email the rest.` });
    }
    setStep("idle");
    onDone();
  }

  return (
    <div className="card card-tint stack-sm">
      <b>Email everyone on the waitlist</b>
      {step === "idle" && (
        <>
          <span className="text-secondary">
            Sends the &ldquo;Mentors are now available on MentorsMD&rdquo; email (edit it in Admin → Emails) to everyone who hasn&apos;t had it yet, with a link to /mentors and a link to leave the waitlist.
          </span>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} disabled={toNotify === 0} onClick={() => setStep("confirm")}>
            {toNotify === 0 ? "Everyone has been emailed" : `Email ${toNotify} ${toNotify === 1 ? "person" : "people"}…`}
          </button>
        </>
      )}
      {step === "confirm" && (
        <>
          <span className="text-secondary">
            Send the email to <b>{toNotify}</b> {toNotify === 1 ? "person" : "people"} now? It goes out in small batches (about 2 a second); keep this page open until it finishes. Each person only ever gets it once.
          </span>
          <div className="row-wrap">
            <button className="btn btn-primary btn-sm" onClick={run}>Yes, send to {toNotify}</button>
            <button className="btn btn-sm" onClick={() => setStep("idle")}>Cancel</button>
          </div>
        </>
      )}
      {step === "sending" && (
        <span role="status" className="text-secondary">
          Sending… {progress.sent} sent{progress.failed ? `, ${progress.failed} failed` : ""}. Keep this page open.
        </span>
      )}
    </div>
  );
}
