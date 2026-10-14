"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Admin -> Mentors: invite a mentor by email, resend or cancel invites,
// and who has joined.
const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function MentorInvites() {
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadInvites = useCallback(() => {
    fetch("/api/invites").then((r) => r.json()).then((d) => setInvites(d.invites || [])).catch(() => {});
  }, []);
  useEffect(loadInvites, [loadInvites]);

  async function createInvite() {
    if (!email.trim()) return;
    setCreating(true);
    setNotice(null);
    const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) return setNotice({ ok: false, text: data.error || "Couldn't create the invite." });
    setEmail("");
    setNotice(data.emailSent === false ? { ok: false, text: data.warning || "Invite created but the email failed. Try Resend." } : { ok: true, text: `Invite sent to ${data.invite?.email}.` });
    loadInvites();
  }

  async function resend(id: string) {
    const res = await fetch(`/api/invites/${id}/resend`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setNotice(res.ok ? { ok: true, text: "Invite email re-sent." } : { ok: false, text: data.error || "The email failed to send." });
  }

  async function cancelInvite(inv: any) {
    if (!confirm(`Cancel the invite for ${inv.email}? Their link stops working.`)) return;
    const res = await fetch(`/api/invites/${inv.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setNotice({ ok: false, text: data.error || "Couldn't cancel the invite." });
    loadInvites();
  }

  const joined = invites.filter((i) => i.status === "REDEEMED");
  const pending = invites.filter((i) => i.status !== "REDEEMED");

  return (
    <>
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      <section className="stack-sm">
        <h2 style={{ fontSize: 30 }}>Invite a mentor</h2>
        <div className="card stack">
          <span className="text-secondary">We email a one-time link (valid 7 days). Nothing for you to copy or send.</span>
          <div className="row">
            <input className="input grow" style={{ marginBottom: 0 }} type="email" placeholder="Mentor's email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createInvite()} />
            <button onClick={createInvite} disabled={creating || !email.trim()} className="btn btn-primary">{creating ? "Sending…" : "Send invite"}</button>
          </div>
        </div>
        <details className="collapse">
          <summary><span className="row" style={{ gap: 8 }}>Pending <span className="tab-count">{pending.length}</span></span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {pending.length === 0 && <span className="text-muted">No pending invites.</span>}
            {pending.map((inv) => {
              const expired = inv.status === "EXPIRED" || (inv.status === "PENDING" && new Date(inv.expiresAt) < new Date());
              return (
                <div key={inv.id} className="list-row" style={{ flexWrap: "wrap" }}>
                  <div className="grow stack-sm" style={{ gap: 2 }}>
                    <b style={{ fontSize: 15 }}>{inv.email}</b>
                    <span className="text-muted">Sent {fmtDay(inv.createdAt)}</span>
                  </div>
                  <span className={`badge ${expired || inv.status === "REVOKED" ? "" : "badge-warning"}`}>
                    {inv.status === "REVOKED" ? "Cancelled" : expired ? "Expired" : "Pending"}
                  </span>
                  {inv.status === "PENDING" && <button onClick={() => resend(inv.id)} className="btn btn-sm">Resend</button>}
                  <button onClick={() => cancelInvite(inv)} className="btn btn-sm btn-danger">{inv.status === "PENDING" && !expired ? "Cancel" : "Delete"}</button>
                </div>
              );
            })}
          </div>
        </details>
        <details className="collapse">
          <summary><span className="row" style={{ gap: 8 }}>Joined <span className="tab-count">{joined.length}</span></span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {joined.length === 0 && <span className="text-muted">Nobody has joined yet.</span>}
            {joined.map((inv) => (
              <div key={inv.id} className="list-row">
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{inv.joinedUser?.name || inv.email}</b>
                  <span className="text-muted">{inv.email}{inv.joinedUser?.createdAt ? ` · joined ${fmtDay(inv.joinedUser.createdAt)}` : ""}</span>
                </div>
                <span className="badge badge-success">Joined</span>
                {inv.redeemedByUserId && <Link href={`/mentors/${inv.redeemedByUserId}`} className="btn btn-sm">Profile</Link>}
              </div>
            ))}
          </div>
        </details>
      </section>
    </>
  );
}
