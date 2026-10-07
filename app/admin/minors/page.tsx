"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminGuard, AdminNav } from "@/components/admin/AdminNav";

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtTime = (d: string) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Waiting for consent", cls: "badge-warning" },
  CONSENTED: { label: "Consent given", cls: "badge-success" },
  WITHDRAWN: { label: "No consent (declined or withdrawn)", cls: "badge-danger" },
};
const REQUEST: Record<string, string> = {
  PENDING: "Waiting",
  CONSENTED: "Consented",
  DECLINED: "Declined",
  EXPIRED: "Link expired",
  WITHDRAWN: "Withdrawn",
  REPLACED: "Replaced by a newer request",
};

function ageOf(dob: string | null) {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

// Admin -> Under 18 (#113): minor accounts and their consent records.
export default function AdminMinorsPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [users, setUsers] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"current" | "adult">("current");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/minors").then((r) => r.json()).then((d) => setUsers(d.users || [])).catch(() => setUsers([]));
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const guard = AdminGuard({ status, isAdmin });
  if (guard) return guard;

  async function resend(u: any) {
    const res = await fetch("/api/admin/minors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resend", userId: u.id }) });
    const d = await res.json().catch(() => ({}));
    setNotice(res.ok ? (d.emailSent === false ? { ok: false, text: "Saved, but the email failed to send." } : { ok: true, text: `New consent link sent to ${u.name}'s parent or guardian.` }) : { ok: false, text: d.error || "That didn't work" });
    load();
  }

  const current = (users || []).filter((u) => u.minorStatus);
  const adults = (users || []).filter((u) => !u.minorStatus);
  const list = tab === "current" ? current : adults;

  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Students under 18</h1>
        <p className="lede">Accounts for students aged 13 to 17, their parent or guardian, and the consent records.</p>
      </div>
      <AdminNav />
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === "current"} onClick={() => setTab("current")}>Under 18 {users && <span className="tab-count">{current.length}</span>}</button>
        <button role="tab" className="tab" aria-selected={tab === "adult"} onClick={() => setTab("adult")}>Turned 18 / closed {users && <span className="tab-count">{adults.length}</span>}</button>
      </div>
      <div className="card" style={{ padding: "4px 20px" }}>
        {users === null && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {users && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>Nobody here yet.</p>}
        {list.map((u) => {
          const s = u.minorStatus ? STATUS[u.minorStatus] : null;
          const age = ageOf(u.dateOfBirth);
          return (
            <details key={u.id} className="list-row" style={{ display: "block" }}>
              <summary className="between" style={{ cursor: "pointer", flexWrap: "wrap", gap: 8 }}>
                <span className="stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{u.name}</b>
                  <span className="text-muted">
                    {u.email}{age !== null ? ` · age ${age}` : ""}{u.dateOfBirth ? ` (born ${fmtDay(u.dateOfBirth)})` : ""} · joined {fmtDay(u.createdAt)} · {u._count.buyerOrders} order{u._count.buyerOrders === 1 ? "" : "s"}
                  </span>
                </span>
                {s ? <span className={`badge ${s.cls}`}>{s.label}</span> : u.becameAdultAt ? <span className="badge">Turned 18 on {fmtDay(u.becameAdultAt)}</span> : null}
              </summary>
              <div className="stack-sm small" style={{ padding: "10px 0 6px" }}>
                {u.parentConsents.length === 0 && <span className="text-muted">No consent requests on file.</span>}
                {u.parentConsents.map((c: any) => (
                  <div key={c.id} className="card card-tint stack-sm" style={{ padding: 14 }}>
                    <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
                      <b>{c.parentName}</b>
                      <span className="badge">{REQUEST[c.status] || c.status}</span>
                    </div>
                    <span><a className="link" href={`mailto:${c.parentEmail}`}>{c.parentEmail}</a> · {c.parentPhone}</span>
                    <span className="text-muted">
                      Requested {fmtTime(c.createdAt)}{c.lastSentAt ? ` · last emailed ${fmtTime(c.lastSentAt)}` : ""} · {c.remindersSent} reminder{c.remindersSent === 1 ? "" : "s"} · link expires {fmtTime(c.expiresAt)}
                    </span>
                    {c.consentedAt && (
                      <div className="kv-grid">
                        <div><span>Signed (typed name)</span>{c.signatureName}</div>
                        <div><span>Consented at</span>{fmtTime(c.consentedAt)}</div>
                        <div><span>IP address</span>{c.ip || "-"}</div>
                        <div><span>Versions</span>Terms {c.termsVersion === 0 ? "built-in" : `v${c.termsVersion}`} · form {c.consentFormVersion === 0 ? "built-in" : `v${c.consentFormVersion}`}</div>
                        <div style={{ gridColumn: "1 / -1" }}><span>Browser</span>{c.userAgent || "-"}</div>
                      </div>
                    )}
                    {c.withdrawnAt && <span className="text-secondary">{c.status === "DECLINED" ? "Declined" : "Withdrawn"} {fmtTime(c.withdrawnAt)}</span>}
                  </div>
                ))}
                {u.minorStatus && u.minorStatus !== "CONSENTED" && (
                  <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => resend(u)}>Email the parent a new link</button>
                )}
              </div>
            </details>
          );
        })}
      </div>
      <span className="text-muted small">Accounts convert to regular accounts automatically on the 18th birthday (checked every morning). The parent&apos;s link then stops working.</span>
    </div>
  );
}
