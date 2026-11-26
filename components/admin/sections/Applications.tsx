"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { applicationSchool } from "@/lib/applicationRules";
import { APPLICATION_STATUS_LABEL } from "@/lib/leadOptions";
import { RowTitle } from "@/components/admin/RowTitle";
import { Collapsible, EmptyState, LoadingBlock } from "@/components/ui";
import { fmtDay } from "@/lib/format";

// Admin -> Mentor applications, for roles that have "Mentor applications"
// but not "Leads" (anyone with Leads is sent to Leads -> Applications).
// The Leads API only answers roles with Leads, so this keeps its own list
// (/api/admin/applications); its rows are built the same way as the Leads
// rows (Collapsible + RowTitle) so the two look identical.

const APP_TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "INVITED", label: "Invited" },
  { key: "DECLINED", label: "Declined" },
] as const;

export function Applications({ onInvited, setNotice }: { onInvited?: () => void; setNotice: (n: { ok: boolean; text: string; link?: string } | null) => void }) {
  const [apps, setApps] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"PENDING" | "INVITED" | "DECLINED">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => {
    fetch("/api/admin/applications").then((r) => r.json()).then((d) => setApps(d.applications || [])).catch(() => setApps([]));
  }, []);
  useEffect(load, [load]);

  async function act(app: any, action: "invite" | "decline" | "reopen") {
    if (action === "invite" && !(await confirm({ title: `Send a mentor invite to ${app.email}?`, body: "They get a one-time link to join (valid 7 days).", confirmLabel: "Send invite" }))) return;
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
      <div className="tabs" role="tablist" aria-label="Mentor applications">
        {APP_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label} {apps && <span className="tab-count">{count(t.key)}</span>}
          </button>
        ))}
      </div>
      {apps === null && <LoadingBlock lines={4} title={false} />}
      {apps && list.length === 0 && <EmptyState>{apps.length === 0 ? "Nothing here yet." : `No ${tab.toLowerCase()} applications.`}</EmptyState>}
      {list.length > 0 && (
        <div className="card" style={{ padding: "4px 20px" }}>
          {list.map((a) => (
            <Collapsible
              key={a.id}
              variant="row"
              className="adm-row"
              title={<RowTitle title={a.name} sub={`${applicationSchool(a)}${a.residency ? ` · ${a.residency}` : ""} · applied ${fmtDay(a.createdAt)}`} />}
              meta={
                a.status !== "PENDING" && (
                  <span className={a.status === "INVITED" ? "badge badge-success" : "badge"}>
                    {APPLICATION_STATUS_LABEL[a.status] || a.status}{a.decidedAt ? ` ${fmtDay(a.decidedAt)}` : ""}
                  </span>
                )
              }
            >
              <div className="stack-sm small" style={{ gap: 12 }}>
                <span>
                  <b>Email:</b> <a className="link" href={`mailto:${a.email}`}>{a.email}</a>
                  {a.phone && <> · <b>Phone:</b> {a.phone}</>}
                </span>
                {a.blurb && <p className="text-secondary" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{a.blurb}</p>}
                <div className="row-wrap">
                  <a href={`/api/admin/applications/${a.id}/resume`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Download resume</a>
                  {a.status !== "INVITED" && (
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy === a.id} onClick={() => act(a, "invite")}>Invite</button>
                  )}
                  {a.status === "PENDING" && (
                    <button type="button" className="btn btn-sm btn-danger" disabled={busy === a.id} onClick={() => act(a, "decline")}>Decline</button>
                  )}
                  {a.status === "DECLINED" && (
                    <button type="button" className="btn btn-sm" disabled={busy === a.id} onClick={() => act(a, "reopen")}>Move back to pending</button>
                  )}
                </div>
              </div>
            </Collapsible>
          ))}
        </div>
      )}
    </section>
  );
}
