"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PeopleTabs } from "@/components/admin/AdminTabs";
import { statusBadge, tintFor, initialsOf } from "@/components/ui";
import { SEVERITY, kindLabel } from "@/components/admin/Flags";
import { BEST_FOR, SCHOOL_TYPES, STAGES, labelFor, money } from "@/lib/options";
import { CREDIT_REASON_LABEL } from "@/lib/hours";
import { useAdminCan } from "@/components/admin/AdminShell";
import { useAdminDialog } from "@/components/admin/AdminDialog";

// Admin -> People: mentors and students, with pause / remove / restore,
// health badges and the "View" panel.
const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function People() {
  // Mentors or students, from the tabs (?role=BUYER for students). The
  // admin search box links here with ?q=<email>&view=<id> to open one person.
  const sp = useSearchParams();
  const role = sp?.get("role") === "BUYER" ? "BUYER" : "SELLER";
  const [q, setQ] = useState(() => sp?.get("q") || "");
  const [users, setUsers] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<{ mentors: number; students: number } | null>(null);
  const [viewing, setViewing] = useState<string | null>(() => sp?.get("view") || null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ role });
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setCounts(d.counts || null);
      })
      .catch(() => setUsers([]));
  }, [role, q]);

  useEffect(() => {
    const t = setTimeout(load, 250); // small debounce while typing
    return () => clearTimeout(t);
  }, [load]);

  const { ask, notify, dialog } = useAdminDialog();

  // Sends the change; returns an error message for the pop-up, or nothing.
  async function send(u: any, action: string, reason?: string): Promise<string | void> {
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Couldn't update";
    load();
    if (action === "remove" && d.activeOrders > 0) {
      setTimeout(() => notify("Removed", `${u.name} has ${d.activeOrders} active order${d.activeOrders === 1 ? "" : "s"}. Open each one to refund or release it.`), 0);
    }
  }

  async function act(u: any, action: string) {
    if (action === "remove") {
      await ask({
        title: `Remove ${u.name}?`,
        body: "They'll be hidden from the site and can't log in. You can restore them later.",
        reason: { label: "Reason (kept on record)", required: true },
        typeToConfirm: u.name,
        confirmLabel: "Remove",
        danger: true,
        run: (reason) => send(u, action, reason),
      });
    } else if (action === "pause") {
      await ask({
        title: `Pause ${u.name} pending review?`,
        body: `${u.role === "SELLER" ? "They'll be hidden from search and can't unpause themselves." : "They won't be able to send messages."} They get an email.`,
        reason: { label: "Reason (kept on record, optional)" },
        confirmLabel: "Pause",
        run: (reason) => send(u, action, reason || undefined),
      });
    } else {
      const err = await send(u, action);
      if (err) notify("Couldn't update", err);
    }
  }
  return (
    <section className="stack-sm">
      {dialog}
      <PeopleTabs role={role} counts={counts} />
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" style={{ marginBottom: 0 }} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
        <a className="btn btn-sm" href={`/api/admin/users?${new URLSearchParams({ role, format: "csv", ...(q.trim() ? { q: q.trim() } : {}) })}`} download>Download CSV</a>
      </div>
      <div className="card" style={{ padding: "4px 20px" }}>
        {users === null && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {users?.length === 0 &&
          (q.trim() ? (
            <div className="row-wrap" style={{ padding: 12 }}>
              <span className="text-muted">No {role === "SELLER" ? "mentors" : "students"} match this search.</span>
              <button type="button" className="btn btn-sm" onClick={() => setQ("")}>Clear Search</button>
            </div>
          ) : (
            <p className="text-muted" style={{ padding: 12 }}>Nothing here yet.</p>
          ))}
        {users?.map((u) => (
          <div key={u.id}>
            <div className="list-row" style={{ flexWrap: "wrap" }}>
              {u.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.photoUrl} alt="" className="avatar" style={{ width: 40, height: 40, objectFit: "cover" }} />
              ) : (
                <span className="avatar" style={{ width: 40, height: 40, fontSize: 15, background: tintFor(u.id) }}>{initialsOf(u.name)}</span>
              )}
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 180 }}>
                <b style={{ fontSize: 15 }}>{u.name}</b>
                <span className="text-muted">
                  {u.email} · joined {fmtDay(u.createdAt)}
                  {role === "SELLER" ? ` · ${u._count.gigs} package${u._count.gigs === 1 ? "" : "s"} · ${u._count.sellerOrders} orders` : ` · ${u._count.buyerOrders} orders`}
                </span>
              </div>
              {u.health && <span className={`badge ${u.health === "Good" ? "badge-success" : u.health === "Watch" ? "badge-warning" : "badge-danger"}`} title="Health: open, high-severity and upheld flags">{u.health}</span>}
              {u.flags?.openFlags > 0 && <span className="badge badge-warning">{u.flags.openFlags} open flag{u.flags.openFlags === 1 ? "" : "s"}</span>}
              {u.flags?.upheld90 > 0 && <span className="badge badge-danger">{u.flags.upheld90} upheld (90 days)</span>}
              {u.minorStatus && <span className="badge badge-warning" title={u.minorStatus === "CONSENTED" ? "Parent consent given" : "Waiting for parent consent"}>Under 18{u.minorStatus === "CONSENTED" ? "" : u.minorStatus === "PENDING" ? " · consent pending" : " · no consent"}</span>}
              {role === "SELLER" && u.acceptsMinors === false && <span className="badge">18+ students only</span>}
              {u.safetyHoldAt && <span className="badge badge-danger">On hold</span>}
              {u.profileStatus === "ACTIVE" && !u.safetyHoldAt && <span className="badge badge-success">Active</span>}
              {u.profileStatus === "PAUSED" && !u.safetyHoldAt && <span className="badge badge-warning">Paused</span>}
              {u.profileStatus === "REMOVED" && <span className="badge badge-danger">{u.removedByAdmin ? "Removed by admin" : "Removed by mentor"}</span>}
              {role === "SELLER" && !u.payoutsConnected && <span className="badge">No payouts</span>}
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setViewing(viewing === u.id ? null : u.id)} aria-expanded={viewing === u.id}>View</button>
                {u.profileStatus !== "REMOVED" && !u.safetyHoldAt && (role === "BUYER" || u.profileStatus === "ACTIVE") && (
                  <button className="btn btn-sm" onClick={() => act(u, "pause")}>Pause</button>
                )}
                {(u.safetyHoldAt || (role === "SELLER" && u.profileStatus === "PAUSED")) && u.profileStatus !== "REMOVED" && (
                  <button className="btn btn-sm" onClick={() => act(u, "unpause")}>Unpause</button>
                )}
                {u.profileStatus !== "REMOVED" ? (
                  <button className="btn btn-sm btn-danger" onClick={() => act(u, "remove")}>Remove</button>
                ) : (
                  <button className="btn btn-sm btn-soft" onClick={() => act(u, "restore")}>Restore</button>
                )}
              </div>
            </div>
            {viewing === u.id && <PersonDetail id={u.id} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function PersonDetail({ id }: { id: string }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/admin/users/${id}`).then((r) => r.json()).then(setD).catch(() => {});
  }, [id]);
  if (!d?.user) return <div className="text-muted" style={{ padding: "0 0 16px 54px" }}>Loading…</div>;
  const u = d.user;
  const isMentor = u.role === "SELLER";
  return (
    <div className="card card-tint stack-sm" style={{ margin: "0 0 16px", padding: 18 }}>
      {u.profileStatus === "REMOVED" && u.removedReason && (
        <div className="alert alert-danger small">Removed {u.removedAt ? fmtDay(u.removedAt) : ""}: {u.removedReason}</div>
      )}
      {u.safetyHoldAt && (
        <div className="alert alert-warning small">On hold since {fmtDay(u.safetyHoldAt)}{u.safetyHoldReason ? `: ${u.safetyHoldReason}` : ""}. Use Unpause once reviewed.</div>
      )}
      <HealthCard d={d} />
      <div className="row-wrap small text-secondary">
        {isMentor && u.mentorStage === "UNDERGRAD" && <span><b>Undergraduate school:</b> {u.undergradSchool || "not added yet"}</span>}
        {isMentor && <span><b>Medical school:</b> {u.medicalSchool || (u.mentorStage === "UNDERGRAD" ? "not given (optional for undergrads)" : "not added yet")}</span>}
        <span><b>Signup source:</b> {u.signupSource ? `${u.signupSource}${u.signupDetail ? ` (${u.signupDetail})` : ""}` : "unknown"}</span>
      </div>
      {isMentor && (
        <>
          <div className="row-wrap small">
            {u.credential && <span><b>Credential:</b> {u.credential}</span>}
            {u.mentorStage && <span className="badge">{labelFor(STAGES, u.mentorStage)}</span>}
            {u.schoolType && <span className="badge">{labelFor(SCHOOL_TYPES, u.schoolType)}</span>}
            {(u.bestFor || []).map((b: string) => <span key={b} className="badge">{labelFor(BEST_FOR, b)}</span>)}
            {u.hourlyRateCents ? <span><b>Rate:</b> {money(u.hourlyRateCents)}/hr</span> : <span className="text-muted">No hourly rate</span>}
            {d.rating?.count > 0 && <span>★ {d.rating.avg?.toFixed(1)} ({d.rating.count})</span>}
            <span>{u.hasAvailability ? "Call hours set" : "No call hours"}{u.timeZone ? ` · ${u.timeZone}` : ""}{u.externalCalConnected ? " · Own calendar connected" : ""}</span>
          </div>
          {u.progress && (
            <div className="small">
              <b>Profile: {u.progress.done} of {u.progress.total} sections</b>{" "}
              {u.progress.complete ? (
                <span className="badge badge-success">Listed</span>
              ) : (
                <span className="text-secondary">
                  (hidden from Browse until finished; missing: {u.progress.sections.filter((x: any) => !x.done).map((x: any) => x.label).join(", ")})
                </span>
              )}
            </div>
          )}
          {u.bio && <p className="text-secondary small" style={{ whiteSpace: "pre-wrap" }}>{u.bio}</p>}
          <div className="row-wrap small">
            {u.gigs.map((g: any) => <span key={g.id} className="badge badge-brand">{g.title} · {money(g.price)}</span>)}
          </div>
          <Link href={`/mentors/${u.id}`} className="link small">Open public profile →</Link>
        </>
      )}
      {d.activity?.length > 0 && (
        <details className="collapse">
          <summary><span className="row" style={{ gap: 8 }}>Recent activity (private) <span className="tab-count">{d.activity.length}</span></span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {d.activity.map((a: any) => (
              <div key={a.id} className="list-row small">
                <span className="text-muted nowrap">{fmtDay(a.createdAt)}</span>
                <span className="grow">{a.text}</span>
              </div>
            ))}
            <Link href="/admin/insights?tab=log" className="link small" style={{ paddingTop: 8 }}>Full activity log →</Link>
          </div>
        </details>
      )}
      {u.role === "BUYER" && <StudentCredit userId={u.id} />}
      <b className="small" style={{ marginTop: 6 }}>Recent packages</b>
      {d.orders.length === 0 && <span className="text-muted">No packages.</span>}
      {d.orders.map((o: any) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="between small" style={{ gap: 10 }}>
          <span className="grow">{o.packageTitle || o.gig.title} · {isMentor ? o.buyer.name : o.seller.name}</span>
          <span>{money(o.amount)}</span>
          {statusBadge(o)}
        </Link>
      ))}
    </div>
  );
}

// A student's MentorsMD credit: balance, history, and (Orders permission)
// a manual adjustment with a required reason (saved in the action log).
function StudentCredit({ userId }: { userId: string }) {
  const canAdjust = useAdminCan("orders");
  const [data, setData] = useState<{ balanceCents: number; entries: any[] } | null>(null);
  const [amount, setAmount] = useState("");
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { confirm, dialog } = useAdminDialog();
  useEffect(() => {
    fetch(`/api/admin/users/${userId}/credit`).then((r) => r.json()).then(setData).catch(() => setData({ balanceCents: 0, entries: [] }));
  }, [userId]);

  async function save() {
    setError("");
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setError("Enter an amount.");
    if (!reason.trim()) return setError("Say why (it's saved in the action log).");
    if (!(await confirm({ title: `${sign > 0 ? "Add" : "Remove"} ${money(cents)} of credit ${sign > 0 ? "to" : "from"} this student?`, body: sign > 0 ? "They get an email (without the reason)." : undefined, confirmLabel: sign > 0 ? "Add Credit" : "Remove Credit", danger: sign < 0 }))) return;
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}/credit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: sign * cents, reason }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "That didn't work");
    setData({ balanceCents: d.balanceCents, entries: d.entries || [] });
    setAmount("");
    setReason("");
  }

  return (
    <details className="collapse">
      <summary><span className="row" style={{ gap: 8 }}>MentorsMD credit <span className="tab-count">{data ? money(data.balanceCents) : "…"}</span></span></summary>
      <div className="collapse-body" style={{ gap: 8 }}>
        {dialog}
        {data && data.entries.length === 0 && <span className="text-muted small">No credit history.</span>}
        {(data?.entries || []).map((e: any) => (
          <div key={e.id} className="list-row small" style={{ flexWrap: "wrap" }}>
            <span className="text-muted nowrap">{fmtDay(e.createdAt)}</span>
            <span className="grow">
              {CREDIT_REASON_LABEL[e.reason] || e.reason}
              {e.packageTitle ? ` · ${e.packageTitle}` : ""}
              {e.note ? ` · ${e.note}` : ""}
              {e.adminName ? ` · by ${e.adminName}` : ""}
            </span>
            <b style={{ color: e.amountCents < 0 ? "var(--danger)" : undefined }}>{e.amountCents < 0 ? "−" : "+"}{money(Math.abs(e.amountCents))}</b>
          </div>
        ))}
        {canAdjust ? (
          <div className="stack-sm" style={{ paddingTop: 6 }}>
            <b className="small">Adjust credit</b>
            <div className="row-wrap">
              <select className="input" style={{ marginBottom: 0, width: "auto" }} value={sign} onChange={(e) => setSign(Number(e.target.value) as 1 | -1)} aria-label="Add or remove">
                <option value={1}>Add</option>
                <option value={-1}>Remove</option>
              </select>
              <input className="input" inputMode="decimal" placeholder="Amount, e.g. 25" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} style={{ marginBottom: 0, maxWidth: 140 }} />
              <input className="input grow" placeholder="Reason (required, for the action log)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 0, minWidth: 200 }} />
              <button className="btn btn-sm" disabled={busy} onClick={save}>Save</button>
            </div>
            <span className="text-muted small">Added credit emails the student (without the reason). Credit never expires and works with any mentor.</span>
            {error && <div role="alert" className="alert alert-danger small">{error}</div>}
          </div>
        ) : (
          <span className="text-muted small">Changing credit needs the Orders permission.</span>
        )}
      </div>
    </details>
  );
}

// Health scorecard (#89): flags, performance numbers and flag history.
function HealthCard({ d }: { d: any }) {
  const h = d.health;
  const u = d.user;
  if (!h) return null;
  const m = h.metrics;
  const cls = h.label === "Good" ? "badge-success" : h.label === "Watch" ? "badge-warning" : "badge-danger";
  return (
    <div className="stack-sm">
      <div className="row-wrap small">
        <b>Health</b> <span className={`badge ${cls}`}>{h.label}</span>
        <span>{h.openFlags} open flag{h.openFlags === 1 ? "" : "s"}{h.highOpen ? ` (${h.highOpen} high)` : ""}</span>
        <span>· {h.upheld90} upheld in 90 days</span>
        {u.role === "BUYER" && <span>· email {u.emailVerified ? "confirmed" : "not confirmed"}</span>}
        {u.role === "BUYER" && (
          <span>
            · {u.dateOfBirth ? `born ${new Date(u.dateOfBirth).toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}` : "no date of birth yet"}
            {u.minorStatus ? <> (under 18: <Link href="/admin/minors" className="link">consent {u.minorStatus === "CONSENTED" ? "given" : u.minorStatus === "PENDING" ? "pending" : "not given"}</Link>)</> : u.becameAdultAt ? " (turned 18 here)" : ""}
          </span>
        )}
        {u.role === "SELLER" && <span>· agreement {u.mentorAgreementVersion ? `v${u.mentorAgreementVersion}${u.mentorAgreementAt ? `, accepted ${fmtDay(u.mentorAgreementAt)}` : ""}` : "not accepted yet"}</span>}
        <span>· last active {u.lastActiveAt ? fmtDay(u.lastActiveAt) : "unknown"}</span>
      </div>
      {m && (
        <div className="kv-grid">
          <div><span>Avg reply (30 days)</span>{m.avgReplyHours === null ? "-" : `${m.avgReplyHours.toFixed(1)} h`}</div>
          <div><span>Unanswered 48h+</span>{m.unanswered.length}</div>
          <div><span>Late / overdue (60 days)</span>{m.overdue60}</div>
          <div><span>Call no-shows (60 days)</span>{m.noShows60}</div>
          <div><span>Late cancels (60 days)</span>{m.lateCancels60}</div>
          <div><span>Revision / dispute / refund</span>{m.problemRate === null ? "-" : `${Math.round(m.problemRate * 100)}% of ${m.orders90}`}</div>
          <div><span>Rating</span>{m.ratingAvg === null ? "-" : `${m.ratingAvg.toFixed(1)} (${m.ratingCount})`}{m.oneStar60 ? ` · ${m.oneStar60}× 1-star` : ""}</div>
          <div><span>Conversations → orders (60 days)</span>{m.convertedConversations60} / {m.conversations60}</div>
        </div>
      )}
      {h.issues.length > 0 && (
        <ul className="small text-secondary" style={{ paddingLeft: 18, margin: 0 }}>
          {h.issues.map((i: any) => <li key={i.key}><b>{i.reason}:</b> {i.details}</li>)}
        </ul>
      )}
      {d.flags?.length > 0 && (
        <details className="collapse">
          <summary><span className="row" style={{ gap: 8 }}>Flag history <span className="tab-count">{d.flags.length}</span></span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {d.flags.map((f: any) => (
              <div key={f.id} className="list-row small" style={{ flexWrap: "wrap" }}>
                <span className="text-muted nowrap">{fmtDay(f.createdAt)}</span>
                <span className={`badge ${(SEVERITY[f.severity] || SEVERITY[1]).cls}`}>{(SEVERITY[f.severity] || SEVERITY[1]).label}</span>
                <span className="badge badge-brand">{kindLabel(f.kind)}</span>
                <span className="grow">{f.reason}</span>
                <span className={`badge ${f.status === "UPHELD" ? "badge-danger" : f.status === "OPEN" ? "badge-warning" : ""}`}>
                  {f.status === "OPEN" ? "Open" : f.status === "UPHELD" ? `Upheld${f.action ? ` (${f.action.toLowerCase()})` : ""}` : "Dismissed"}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {d.actions?.length > 0 && (
        <details className="collapse">
          <summary><span className="row" style={{ gap: 8 }}>Admin actions <span className="tab-count">{d.actions.length}</span></span></summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {d.actions.map((a: any) => (
              <div key={a.id} className="list-row small">
                <span className="text-muted nowrap">{fmtDay(a.createdAt)}</span>
                <span className="grow">{a.summary}</span>
                <span className="badge">{a.admin?.name || "System"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
