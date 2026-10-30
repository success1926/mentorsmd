"use client";

import { Fragment, useEffect, useState } from "react";
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_GROUPS } from "@/lib/adminPermissions";
import { useAdminDialog } from "@/components/admin/AdminDialog";

// Admin -> Team & roles -> Roles: a tick-box matrix of admin areas (rows)
// by role (columns). Owner and Admin always have everything. Only the
// Owner can add, edit or delete custom roles; a role someone uses can't be
// deleted. The server checks all of this again (app/api/admin/team/roles).

export type CustomRole = { id: string; name: string; permissions: string[]; members: number; openInvites: number };

// The role picker's value: "OWNER", "ADMIN" or "role:<id>".
export function rolePickValue(m: { adminRole: string; adminRoleId?: string | null }) {
  return m.adminRole === "OWNER" ? "OWNER" : m.adminRoleId ? `role:${m.adminRoleId}` : "ADMIN";
}
export function rolePickToBody(v: string) {
  return v.startsWith("role:") ? { adminRole: "ADMIN", roleId: v.slice(5) } : { adminRole: v === "OWNER" ? "OWNER" : "ADMIN", roleId: null };
}

type Notice = { ok: boolean; text: string } | null;

export function TeamRoles({ roles, isOwner, onChanged, setNotice }: { roles: CustomRole[]; isOwner: boolean; onChanged: () => void; setNotice: (n: Notice) => void }) {
  // Unsaved tick boxes, per role id.
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, confirm, dialog } = useAdminDialog();
  useEffect(() => setDraft({}), [roles]);

  const permsOf = (r: CustomRole) => draft[r.id] ?? r.permissions;
  const dirty = (r: CustomRole) => !!draft[r.id] && [...draft[r.id]].sort().join() !== [...r.permissions].sort().join();

  function toggle(r: CustomRole, key: string) {
    const cur = permsOf(r);
    setDraft({ ...draft, [r.id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
  }

  async function call(url: string, method: string, body?: unknown, ok = "Saved.") {
    setBusy(true);
    setNotice(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setNotice(res.ok ? { ok: true, text: ok } : { ok: false, text: d.error || "That didn't work" });
    if (res.ok) onChanged();
    return res.ok;
  }

  async function addRole() {
    const name = newName.trim();
    if (!name) return;
    if (await call("/api/admin/team/roles", "POST", { name, permissions: ["overview"] }, `Role "${name}" added. Tick the areas it can open, then Save.`)) setNewName("");
  }

  async function rename(r: CustomRole) {
    const name = await ask({ title: `Rename "${r.name}"`, reason: { label: "New name", initial: r.name, singleLine: true, maxLength: 40, required: true, requiredMessage: "Type a name." }, confirmLabel: "Rename" });
    if (name && name !== r.name) call(`/api/admin/team/roles/${r.id}`, "PATCH", { name }, "Role renamed.");
  }

  async function remove(r: CustomRole) {
    if (r.members > 0 || r.openInvites > 0) {
      setNotice({ ok: false, text: `"${r.name}" is in use. Give its members another role (or cancel the invite) first.` });
      return;
    }
    if (await confirm({ title: `Delete the role "${r.name}"?`, body: "Nobody uses it, so nothing else changes.", confirmLabel: "Delete Role", danger: true })) call(`/api/admin/team/roles/${r.id}`, "DELETE", undefined, "Role deleted.");
  }

  return (
    <section className="stack-sm" id="roles">
      {dialog}
      <h2 style={{ fontSize: 30 }}>Roles</h2>
      <span className="text-secondary">
        What each role can open in Admin. Owner and Admin always have everything.{" "}
        {isOwner ? "Add a role for someone who only needs part of Admin, tick its areas and Save. Changes apply on their next click." : "Only the Owner can change roles."}
      </span>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="adm-matrix">
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Owner</th>
              <th scope="col">Admin</th>
              {roles.map((r) => (
                <th key={r.id} scope="col">
                  <span className="stack-sm" style={{ gap: 2, alignItems: "center" }}>
                    <span>{r.name}</span>
                    <span className="text-muted small" style={{ fontWeight: 400 }}>
                      {r.members} member{r.members === 1 ? "" : "s"}{r.openInvites ? ` · ${r.openInvites} invited` : ""}
                    </span>
                    {isOwner && (
                      <span className="row" style={{ gap: 4 }}>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => rename(r)} disabled={busy}>Rename</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(r)} disabled={busy}>Delete</button>
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ADMIN_PERMISSION_GROUPS.map((g) => (
              <Fragment key={g}>
                <tr className="adm-matrix-group">
                  <th scope="rowgroup" colSpan={3 + roles.length}>{g}</th>
                </tr>
                {ADMIN_PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <tr key={p.key}>
                    <th scope="row">{p.label}</th>
                    <td><input type="checkbox" checked disabled aria-label={`Owner: ${p.label}`} /></td>
                    <td><input type="checkbox" checked disabled aria-label={`Admin: ${p.label}`} /></td>
                    {roles.map((r) => (
                      <td key={r.id}>
                        <input type="checkbox" checked={permsOf(r).includes(p.key)} disabled={!isOwner || busy} onChange={() => toggle(r, p.key)} aria-label={`${r.name}: ${p.label}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            {isOwner && roles.some(dirty) && (
              <tr>
                <th scope="row" />
                <td />
                <td />
                {roles.map((r) => (
                  <td key={r.id}>
                    {dirty(r) && (
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => call(`/api/admin/team/roles/${r.id}`, "PATCH", { permissions: permsOf(r) }, `Saved "${r.name}".`)}>
                        Save
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isOwner && (
        <div className="row-wrap">
          <input className="input grow" style={{ marginBottom: 0, minWidth: 200, maxWidth: 320 }} placeholder="New role name, e.g. Support" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} aria-label="New role name" />
          <button type="button" className="btn" disabled={busy || !newName.trim()} onClick={addRole}>Add role</button>
        </div>
      )}
      <span className="text-muted small">Refunds, releases and earnings need Orders. Disputes without Orders can talk to both sides but not move money.</span>
    </section>
  );
}
