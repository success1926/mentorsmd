"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminDialog } from "@/components/admin/AdminDialog";

// Admin -> Mentor applications: the list (Pending / Invited / Declined)
// and its actions. Self-contained so it can grow into a leads inbox.
const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const APP_TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "INVITED", label: "Invited" },
  { key: "DECLINED", label: "Declined" },
] as const;

export function Applications({ onInvited, setNotice }: { onInvited?: () => void; setNotice: (n: { ok: boolean; text: string; link?: string } | null) => void }) {
  const [apps, setApps] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"PENDING" | "INVITED" | "DECLINED">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useAdminDialog();

  const load = useCallback(() => {
    fetch("/api/admin/applications").then((r) => r.json()).then((d) => setApps(d.applications || [])).catch(() => setApps([]));
  }, []);
  useEffect(load, [load]);

  async function act(app: any, action: "invite" | "decline" | "reopen") {
    if (action === "invite" && !(await confirm({ title: `Send a mentor invite to ${app.email}?`, body: "They get a one-time link to join (valid 7 days).", confirmLabel: "Send Invite" }))) return;
    if (action === "decline" && !(await confirm({ title: `Decline ${app.name}'s application?`, body: "No email is sent. You can move it back to pending later.", confirmLabel: "Decline", danger: true }))) return;
    setBusy(app.id);
    const res = await fetch(`/api/admin/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setNotice({ ok: false, text: d.error || "That didn't work." });
    else if (action === "invite") {
      setNotice(d.emailSent === false ? { ok: false, text: d.warning || "Invite created but the email failed. Use Resend on the Mentors page.", link: d.link } : { ok: true, text: `Invite sent to ${app.email}.` });
      onInvited?.();
    }
    load();
  }

  const list = (apps || []).filter((a) => a.status === tab);
  const count = (k: string) => (apps || []).filter((a) => a.status === k).length;

  return (
    <section className="stack-sm" id="applications">
      {dialog}
      <h2 style={{ fontSize: 30 }}>Mentor applications</h2>
      <div className="tabs" role="tablist">
        {APP_TABS.map((t) => (
          <button key={t.key} role="tab" className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} {apps && <span className="tab-count">{count(t.key)}</span>}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: "4px 20px" }}>
        {apps === null && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {apps && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>{apps.length === 0 ? "Nothing here yet." : `No ${tab.toLowerCase()} applications.`}</p>}
        {list.map((a) => (
          <details key={a.id} className="list-row" style={{ display: "block" }}>
            <summary className="between" style={{ cursor: "pointer", flexWrap: "wrap", gap: 8 }}>
              <span className="stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{a.name}</b>
                <span className="text-muted">{a.medicalSchool}{a.residency ? ` · ${a.residency}` : ""} · applied {fmtDay(a.createdAt)}</span>
              </span>
              {a.status === "INVITED" && <span className="badge badge-success">Invited{a.decidedAt ? ` ${fmtDay(a.decidedAt)}` : ""}</span>}
              {a.status === "DECLINED" && <span className="badge">Declined{a.decidedAt ? ` ${fmtDay(a.decidedAt)}` : ""}</span>}
            </summary>
            <div className="stack-sm small" style={{ padding: "10px 0 6px" }}>
              <span><b>Email:</b> <a className="link" href={`mailto:${a.email}`}>{a.email}</a> · <b>Phone:</b> {a.phone}</span>
              <p className="text-secondary" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{a.blurb}</p>
              <div className="row-wrap">
                <a href={`/api/admin/applications/${a.id}/resume`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Download resume</a>
                {a.status !== "INVITED" && (
                  <button className="btn btn-sm btn-primary" disabled={busy === a.id} onClick={() => act(a, "invite")}>Invite</button>
                )}
                {a.status === "PENDING" && (
                  <button className="btn btn-sm btn-danger" disabled={busy === a.id} onClick={() => act(a, "decline")}>Decline</button>
                )}
                {a.status === "DECLINED" && (
                  <button className="btn btn-sm" disabled={busy === a.id} onClick={() => act(a, "reopen")}>Move back to pending</button>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
