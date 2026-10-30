"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminGuard } from "@/components/admin/AdminNav";
import { logOut } from "@/components/TopNav";
import { CopyLink } from "@/components/admin/CopyLink";
import { useAdminDialog } from "@/components/admin/AdminDialog";
import { TeamRoles, rolePickToBody, rolePickValue, type CustomRole } from "@/components/admin/TeamRoles";

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Admin -> Team & roles (#114-#118). Anyone whose role includes Team can
// see it; only Owners can invite, change roles, disable, remove, reset
// 2-step verification or edit custom roles.
export default function AdminTeamPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const [data, setData] = useState<{ me: { id: string; isOwner: boolean }; members: any[]; invites: any[]; roles: CustomRole[] } | null>(null);
  const [email, setEmail] = useState("");
  // "OWNER", "ADMIN" or "role:<id>" for a custom role.
  const [role, setRole] = useState("ADMIN");
  const [busy, setBusy] = useState(false);
  // `link`: the invite link, shown with a Copy button when the email failed.
  const [notice, setNotice] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const { confirm, dialog } = useAdminDialog();

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
    const res = await fetch("/api/admin/team/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, ...rolePickToBody(role) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNotice({ ok: false, text: d.error || "Couldn't send the invite" });
    setNotice(d.emailSent === false ? { ok: false, text: d.warning, link: d.link } : { ok: true, text: `Invite sent to ${email}.` });
    setEmail("");
    load();
  }

  async function inviteAction(inv: any, method: "POST" | "DELETE") {
    if (method === "DELETE" && !(await confirm({ title: `Cancel the invite for ${inv.email}?`, body: "Their link stops working.", confirmLabel: "Cancel Invite", cancelLabel: "Keep It", danger: true }))) return;
    const res = await fetch(`/api/admin/team/invites/${inv.id}`, { method });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.emailSent === false) setNotice({ ok: false, text: d.warning, link: d.link });
    else setNotice(res.ok ? { ok: true, text: method === "POST" ? `New invite link sent to ${inv.email}.` : "Invite cancelled." } : { ok: false, text: d.error || "That didn't work" });
    load();
  }

  async function memberAction(m: any, action: string, extra: Record<string, unknown> = {}) {
    const prompts: Record<string, { title: string; body: string; label: string; danger?: boolean }> = {
      disable: { title: `Turn off ${m.name}'s admin access?`, body: "They're logged out right away and can't log in until you turn it back on.", label: "Disable", danger: true },
      remove: { title: `Remove ${m.name} from the team?`, body: "They're logged out right away and lose admin access for good (you can invite them again later).", label: "Remove", danger: true },
      "reset-2fa": { title: `Reset ${m.name}'s 2-step verification?`, body: "They're logged out and set it up again at their next login.", label: "Reset 2-Step" },
      "end-sessions": { title: `Log ${m.name} out on every device?`, body: "They'll need to log in again.", label: "Log Out Everywhere" },
    };
    const p = prompts[action];
    if (p && !(await confirm({ title: p.title, body: p.body, confirmLabel: p.label, danger: p.danger, typeToConfirm: action === "remove" ? m.name : undefined }))) return;
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
        <h1 className="page-title">Team &amp; roles</h1>
        <p className="lede">Who can use Admin. Owners manage the team and roles; Admins can do everything else; a custom role only opens the areas ticked for it.</p>
      </div>
      {dialog}
      {notice && (
        <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>
          {notice.text}
          {notice.link && <CopyLink link={notice.link} />}
        </div>
      )}
      {data && !isOwner && <div className="alert alert-blue">Only Owners can invite or change team members.</div>}

      {isOwner && (
        <section className="card stack">
          <h2 style={{ fontSize: 26 }}>Invite someone</h2>
          <span className="text-secondary">We email them a one-time link (valid 7 days). They choose their own password and set up 2-step verification. Use an email that isn&apos;t already a student or mentor account.</span>
          <div className="row-wrap">
            <input className="input grow" style={{ marginBottom: 0, minWidth: 220 }} type="email" placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <RolePicker value={role} onChange={setRole} roles={data?.roles || []} label="Role for the new team member" />
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
                <span className={`badge ${m.adminRole === "OWNER" ? "badge-brand" : ""}`}>{m.roleName}</span>
                <span className={`badge ${m.twoFactorMethod ? "badge-success" : "badge-warning"}`}>
                  {m.twoFactorMethod === "TOTP" ? "2-step: app" : m.twoFactorMethod === "EMAIL" ? "2-step: email" : "2-step not set up yet"}
                </span>
                {m.adminDisabledAt && <span className="badge badge-danger">Disabled {fmtDay(m.adminDisabledAt)}</span>}
                {isOwner && (
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {/* Nobody changes their own role or an Owner's. */}
                    {!me && m.adminRole !== "OWNER" && (
                      <RolePicker
                        value={rolePickValue(m)}
                        roles={data.roles}
                        label={`Role for ${m.name}`}
                        onChange={async (v) => {
                          if (v === "OWNER" && !(await confirm({ title: `Make ${m.name} an Owner?`, body: "Owners have full access and manage the team, and an Owner's role can't be changed afterwards.", confirmLabel: "Make Owner", typeToConfirm: m.name }))) return;
                          memberAction(m, "role", rolePickToBody(v));
                        }}
                      />
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
        <span className="text-muted small">Disabling or removing someone logs them out immediately. There must always be at least one active Owner. Every change is in the Action log.</span>
      </section>

      {data && <TeamRoles roles={data.roles} isOwner={isOwner} onChanged={load} setNotice={setNotice} />}

      {(pendingInvites.length > 0 || expiredInvites.length > 0) && (
        <section className="stack-sm">
          <h2 style={{ fontSize: 30 }}>Invites</h2>
          <div className="card" style={{ padding: "4px 20px" }}>
            {[...pendingInvites, ...expiredInvites].map((inv) => (
              <div key={inv.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{inv.email}</b>
                  <span className="text-muted">
                    {inv.roleName} · sent {fmtDay(inv.createdAt)}{inv.invitedBy?.name ? ` by ${inv.invitedBy.name}` : ""}
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

      {isOwner && <SentryTest />}
    </div>
  );
}

// Owner only: sends one test event so you can check Sentry (error
// reports) is connected. Says whether SENTRY_DSN is set.
function SentryTest() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/sentry-test", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "Couldn't send the test error" });
    setMsg(
      d.enabled
        ? { ok: true, text: "Sentry is on. A test error was sent: it should appear in Sentry → Issues within a minute." }
        : { ok: false, text: "Sentry is off: SENTRY_DSN isn't set in Vercel, so nothing was sent. Errors only go to the server logs." }
    );
  }
  return (
    <section className="card stack-sm">
      <h2 style={{ fontSize: 22 }}>Error reports (Sentry)</h2>
      <span className="text-secondary">Server and page errors are sent to Sentry when SENTRY_DSN is set. Use this to check it&apos;s connected.</span>
      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={send}>
        {busy ? "Sending…" : "Send a test error"}
      </button>
      {msg && <div role="status" className={`alert ${msg.ok ? "alert-success" : "alert-warning"}`}>{msg.text}</div>}
    </section>
  );
}

function RolePicker({ value, onChange, roles, label }: { value: string; onChange: (v: string) => void; roles: CustomRole[]; label: string }) {
  return (
    <select className="input" style={{ marginBottom: 0, width: "auto", minWidth: 160 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="ADMIN">Admin (full access)</option>
      {roles.map((r) => (
        <option key={r.id} value={`role:${r.id}`}>{r.name}</option>
      ))}
      <option value="OWNER">Owner</option>
    </select>
  );
}
