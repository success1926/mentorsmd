"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminGuard, AdminNav } from "@/components/admin/AdminNav";
import { logOut } from "@/components/TopNav";

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Admin -> Team (#114-#118). Everyone on the team can see it; only Owners
// can invite, change roles, disable, remove or reset 2-step verification.
export default function AdminTeamPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [data, setData] = useState<{ me: { id: string; isOwner: boolean }; members: any[]; invites: any[] } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OWNER">("ADMIN");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/team").then((r) => r.json()).then((d) => (d.members ? setData(d) : null)).catch(() => {});
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const guard = AdminGuard({ status, isAdmin });
  if (guard) return guard;

  const isOwner = !!data?.me.isOwner;

  async function invite() {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/admin/team/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, adminRole: role }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't send the invite" });
    setNotice(d.emailSent === false ? { ok: false, text: d.warning } : { ok: true, text: `Invite sent to ${email}.` });
    setEmail("");
    load();
  }

  async function inviteAction(inv: any, method: "POST" | "DELETE") {
    if (method === "DELETE" && !confirm(`Cancel the invite for ${inv.email}? Their link stops working.`)) return;
    const res = await fetch(`/api/admin/team/invites/${inv.id}`, { method });
    const d = await res.json().catch(() => ({}));
    setNotice(res.ok ? { ok: true, text: method === "POST" ? `New invite link sent to ${inv.email}.` : "Invite cancelled." } : { ok: false, text: d.error || "That didn't work" });
    load();
  }

  async function memberAction(m: any, action: string, extra: Record<string, unknown> = {}) {
    const prompts: Record<string, string> = {
      disable: `Turn off ${m.name}'s admin access? They're logged out right away and can't log in until you turn it back on.`,
      remove: `Remove ${m.name} from the team? They're logged out right away and lose admin access for good (you can invite them again later).`,
      "reset-2fa": `Reset ${m.name}'s 2-step verification? They're logged out and set it up again at their next login.`,
      "end-sessions": `Log ${m.name} out on every device?`,
    };
    if (prompts[action] && !confirm(prompts[action])) return;
    const res = await fetch(`/api/admin/team/members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ ok: false, text: d.error || "That didn't work" });
    if (d.loggedOut) return logOut("/login");
    setNotice({ ok: true, text: "Saved." });
    load();
  }

  const pendingInvites = (data?.invites || []).filter((i) => !i.expired);
  const expiredInvites = (data?.invites || []).filter((i) => i.expired);

  return (
    <div className="page stack-lg" style={{ gap: 32 }}>
      <div className="stack-sm">
        <h1 className="page-title">Team</h1>
        <p className="lede">Who can use Admin. Owners manage the team; Admins can do everything else.</p>
      </div>
      <AdminNav />
      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}
      {data && !isOwner && <div className="alert alert-blue">Only Owners can invite or change team members.</div>}

      {isOwner && (
        <section className="card stack">
          <h2 style={{ fontSize: 26 }}>Invite someone</h2>
          <span className="text-secondary">We email them a one-time link (valid 7 days). They choose their own password and set up 2-step verification. Use an email that isn&apos;t already a student or mentor account.</span>
          <div className="row-wrap">
            <input className="input grow" style={{ marginBottom: 0, minWidth: 220 }} type="email" placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="seg">
              <button type="button" className="seg-opt" aria-pressed={role === "ADMIN"} onClick={() => setRole("ADMIN")}>Admin</button>
              <button type="button" className="seg-opt" aria-pressed={role === "OWNER"} onClick={() => setRole("OWNER")}>Owner</button>
            </div>
            <button className="btn btn-primary" disabled={busy || !email.trim()} onClick={invite}>{busy ? "Sending…" : "Send invite"}</button>
          </div>
        </section>
      )}

      <section className="stack-sm">
        <h2 style={{ fontSize: 30 }}>Members</h2>
        <div className="card" style={{ padding: "4px 20px" }}>
          {!data && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
          {data?.members.map((m) => {
            const me = m.id === data.me.id;
            return (
              <div key={m.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2, minWidth: 200 }}>
                  <b style={{ fontSize: 15 }}>{m.name}{me ? " (you)" : ""}</b>
                  <span className="text-muted">
                    {m.email} · joined {fmtDay(m.createdAt)}{m.lastActiveAt ? ` · last active ${fmtDay(m.lastActiveAt)}` : ""}
                  </span>
                </div>
                <span className={`badge ${m.adminRole === "OWNER" ? "badge-brand" : ""}`}>{m.adminRole === "OWNER" ? "Owner" : "Admin"}</span>
                <span className={`badge ${m.twoFactorMethod ? "badge-success" : "badge-warning"}`}>
                  {m.twoFactorMethod === "TOTP" ? "2-step: app" : m.twoFactorMethod === "EMAIL" ? "2-step: email" : "2-step not set up yet"}
                </span>
                {m.adminDisabledAt && <span className="badge badge-danger">Disabled {fmtDay(m.adminDisabledAt)}</span>}
                {isOwner && (
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {m.adminRole === "OWNER" ? (
                      <button className="btn btn-sm" onClick={() => memberAction(m, "role", { adminRole: "ADMIN" })}>Make Admin</button>
                    ) : (
                      <button className="btn btn-sm" onClick={() => memberAction(m, "role", { adminRole: "OWNER" })}>Make Owner</button>
                    )}
                    {m.twoFactorMethod && <button className="btn btn-sm" onClick={() => memberAction(m, "reset-2fa")}>Reset 2-step</button>}
                    {!me && <button className="btn btn-sm" onClick={() => memberAction(m, "end-sessions")}>Log out everywhere</button>}
                    {!me && (m.adminDisabledAt ? (
                      <button className="btn btn-sm btn-soft" onClick={() => memberAction(m, "enable")}>Turn back on</button>
                    ) : (
                      <button className="btn btn-sm" onClick={() => memberAction(m, "disable")}>Disable</button>
                    ))}
                    {!me && <button className="btn btn-sm btn-danger" onClick={() => memberAction(m, "remove")}>Remove</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <span className="text-muted small">Disabling or removing someone logs them out immediately. There must always be at least one active Owner. Every change is in the action log on the Overview tab.</span>
      </section>

      {(pendingInvites.length > 0 || expiredInvites.length > 0) && (
        <section className="stack-sm">
          <h2 style={{ fontSize: 30 }}>Invites</h2>
          <div className="card" style={{ padding: "4px 20px" }}>
            {[...pendingInvites, ...expiredInvites].map((inv) => (
              <div key={inv.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{inv.email}</b>
                  <span className="text-muted">
                    {inv.adminRole === "OWNER" ? "Owner" : "Admin"} · sent {fmtDay(inv.createdAt)}{inv.invitedBy?.name ? ` by ${inv.invitedBy.name}` : ""}
                  </span>
                </div>
                <span className={`badge ${inv.expired ? "" : "badge-warning"}`}>{inv.expired ? "Expired" : "Pending"}</span>
                {isOwner && (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => inviteAction(inv, "POST")}>Resend</button>
                    <button className="btn btn-sm btn-danger" onClick={() => inviteAction(inv, "DELETE")}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
