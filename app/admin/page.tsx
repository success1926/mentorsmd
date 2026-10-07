"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { StaffBadge, statusBadge, tintFor, initialsOf } from "@/components/ui";
import { ActionLog, FlagsAdmin, SEVERITY, kindLabel } from "@/components/admin/Flags";
import { AdminNav } from "@/components/admin/AdminNav";
import { DeliveryCard } from "@/components/Deliveries";
import { Attendance, Recordings } from "@/components/Calls";
import { BACKGROUNDS, SCHOOL_TYPES, STAGES, labelFor, money } from "@/lib/options";

const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function AdminPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [earnings, setEarnings] = useState<any>(null);
  const [disputes, setDisputes] = useState<{ open: any[]; resolved: any[] }>({ open: [], resolved: [] });
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadDisputes = useCallback(() => {
    fetch("/api/admin/disputed-orders").then((r) => r.json()).then((d) => setDisputes({ open: d.open || [], resolved: d.resolved || [] })).catch(() => {});
  }, []);
  const loadInvites = useCallback(() => {
    fetch("/api/invites").then((r) => r.json()).then((d) => setInvites(d.invites || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadDisputes();
    loadInvites();
    fetch("/api/admin/earnings").then((r) => r.json()).then(setEarnings).catch(() => {});
  }, [isAdmin, loadDisputes, loadInvites]);

  if (status === "loading") return <div className="page text-muted">Loading…</div>;
  if (!isAdmin) return <div className="page-narrow"><div className="alert alert-danger">Admin access required.</div></div>;

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
    <div className="page stack-lg" style={{ gap: 36 }}>
      <div className="stack-sm">
        <h1 className="page-title">Admin</h1>
        <p className="lede">Flags, disputes, calls, mentor applications, invites and people.</p>
      </div>
      <AdminNav />

      {earnings && (
        <div className="stat-cards">
          {[
            ["Total collected", earnings.totalCollectedCents, "var(--tint-soft)"],
            ["Your 20% cut", earnings.platformCutCents, "var(--pink-soft)"],
            ["Paid to mentors", earnings.paidToSellersCents, "var(--blue)"],
            ["Held right now", earnings.inEscrowCents, "var(--tint-soft)"],
          ].map(([label, cents, bg]: any) => (
            <div key={label} className="stat-card" style={{ background: bg }}>
              <span className="text-secondary">{label}</span>
              <span className="stat-num">{money(cents)}</span>
            </div>
          ))}
        </div>
      )}

      {notice && <div role="status" className={`alert ${notice.ok ? "alert-success" : "alert-danger"}`}>{notice.text}</div>}

      {/* ---------- Flags: reports, disputes, automatic flags ---------- */}
      <FlagsAdmin onChanged={loadDisputes} />

      {/* ---------- Disputes ---------- */}
      <section className="stack-sm" id="disputes">
        <h2 style={{ fontSize: 30 }}>Disputes</h2>
        <details className="collapse" open={disputes.open.length > 0}>
          <summary>
            <span className="row" style={{ gap: 8 }}>Pending <span className="tab-count">{disputes.open.length}</span></span>
          </summary>
          <div className="collapse-body">
            {disputes.open.length === 0 && <span className="text-muted">No open disputes.</span>}
            {disputes.open.map((o) => (
              <DisputeCard key={o.id} order={o} onResolved={loadDisputes} />
            ))}
          </div>
        </details>
        <details className="collapse">
          <summary>
            <span className="row" style={{ gap: 8 }}>Resolved <span className="tab-count">{disputes.resolved.length}</span></span>
          </summary>
          <div className="collapse-body" style={{ gap: 0 }}>
            {disputes.resolved.length === 0 && <span className="text-muted">Nothing resolved yet.</span>}
            {disputes.resolved.map((o) => (
              <div key={o.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <b>{o.gig.title}</b>
                  <span className="text-muted">{o.buyer.name} vs. {o.seller.name} · {money(o.amount)}</span>
                </div>
                <span className={`badge ${o.status === "REFUNDED" ? "badge-pink" : "badge-success"}`}>
                  {o.status === "REFUNDED" ? "Refunded to student" : "Released to mentor"}
                </span>
                {o.disputeResolvedAt && <span className="text-muted">{fmtDay(o.disputeResolvedAt)}</span>}
                <Link href={`/orders/${o.id}`} className="btn btn-sm">View</Link>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* ---------- Calls & recordings ---------- */}
      <CallsAdmin />

      {/* ---------- Mentor applications ---------- */}
      <Applications onInvited={loadInvites} setNotice={setNotice} />

      {/* ---------- Invites ---------- */}
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

      {/* ---------- People ---------- */}
      <People />

      {/* ---------- Custom "Other" services ---------- */}
      <CustomServices />

      {/* ---------- Action log ---------- */}
      <ActionLog />
    </div>
  );
}

// ---------------- Calls: attendance + recordings ----------------
function CallsAdmin() {
  const [data, setData] = useState<{ calls: any[]; setup: any } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [hookMsg, setHookMsg] = useState("");
  useEffect(() => {
    fetch("/api/admin/calls").then((r) => r.json()).then((d) => setData({ calls: d.calls || [], setup: d.setup || {} })).catch(() => setData({ calls: [], setup: {} }));
  }, []);

  async function connectWebhook() {
    setHookMsg("");
    const res = await fetch("/api/admin/daily-webhook", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setHookMsg(d.error || "Couldn't connect the webhook");
    setSecret(d.secret);
  }

  const now = Date.now();
  const calls = data?.calls || [];
  const past = calls.filter((c) => new Date(c.endTime).getTime() < now && c.status !== "CANCELLED");
  const upcoming = calls.filter((c) => new Date(c.endTime).getTime() >= now && c.status === "BOOKED").reverse();
  const setup = data?.setup || {};

  return (
    <section className="stack-sm" id="calls">
      <h2 style={{ fontSize: 30 }}>Calls &amp; recordings</h2>
      {data && (
        <div className="row-wrap small">
          <span className={`badge ${setup.video ? "badge-success" : "badge-danger"}`}>{setup.video ? "Video on" : "Video off: set DAILY_API_KEY"}</span>
          <span className={`badge ${setup.recording ? "badge-success" : ""}`}>{setup.recording ? "Recording on" : "Recording off"}</span>
          <span className={`badge ${setup.webhookSecret ? "badge-success" : "badge-warning"}`}>{setup.webhookSecret ? "Attendance webhook secured" : "Attendance webhook not secured"}</span>
          {setup.video && !setup.webhookSecret && !secret && <button className="btn btn-sm" onClick={connectWebhook}>Connect Daily webhook</button>}
        </div>
      )}
      {hookMsg && <div className="alert alert-danger">{hookMsg}</div>}
      {secret && (
        <div className="alert alert-success stack-sm">
          <b>Webhook connected.</b>
          <span>Copy this secret into Vercel → Settings → Environment Variables as <code>DAILY_WEBHOOK_SECRET</code>, then redeploy:</span>
          <input className="input" readOnly value={secret} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, marginBottom: 0 }} />
        </div>
      )}
      <span className="text-secondary">Recordings are only for checking problems (disputes, no-shows). They&apos;re deleted automatically 60 days after the order closes.</span>
      <details className="collapse">
        <summary><span className="row" style={{ gap: 8 }}>Upcoming <span className="tab-count">{upcoming.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {upcoming.length === 0 && <span className="text-muted">No upcoming calls.</span>}
          {upcoming.map((c) => (
            <div key={c.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                <span className="text-muted">{c.order.gig.title} · {c.order.buyer.name} (student) with {c.order.seller.name} (mentor)</span>
              </div>
              <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open order</Link>
            </div>
          ))}
        </div>
      </details>
      <details className="collapse">
        <summary><span className="row" style={{ gap: 8 }}>Past 60 days <span className="tab-count">{past.length}</span></span></summary>
        <div className="collapse-body" style={{ gap: 0 }}>
          {past.length === 0 && <span className="text-muted">No calls yet.</span>}
          {past.map((c) => (
            <div key={c.id} className="list-row" style={{ display: "block" }}>
              <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="stack-sm" style={{ gap: 2 }}>
                  <b style={{ fontSize: 15 }}>{new Date(c.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>
                  <span className="text-muted">{c.order.gig.title} · {c.order.buyer.name} (student) with {c.order.seller.name} (mentor)</span>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  {c.order.disputed && <span className="badge badge-danger">Disputed</span>}
                  <Link href={`/orders/${c.order.id}`} className="btn btn-sm">Open order</Link>
                </span>
              </div>
              <div className="stack-sm" style={{ paddingTop: 8 }}>
                <Attendance booking={c} order={c.order} />
                <Recordings booking={c} />
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

// ---------------- Mentor applications ----------------
const APP_TABS = [
  { key: "PENDING", label: "Pending" },
  { key: "INVITED", label: "Invited" },
  { key: "DECLINED", label: "Declined" },
] as const;

function Applications({ onInvited, setNotice }: { onInvited: () => void; setNotice: (n: { ok: boolean; text: string } | null) => void }) {
  const [apps, setApps] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"PENDING" | "INVITED" | "DECLINED">("PENDING");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/applications").then((r) => r.json()).then((d) => setApps(d.applications || [])).catch(() => setApps([]));
  }, []);
  useEffect(load, [load]);

  async function act(app: any, action: "invite" | "decline" | "reopen") {
    if (action === "invite" && !confirm(`Send a mentor invite to ${app.email}?`)) return;
    if (action === "decline" && !confirm(`Decline ${app.name}'s application? No email is sent.`)) return;
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
      setNotice(d.emailSent === false ? { ok: false, text: d.warning || "Invite created but the email failed. Use Resend under Invite a mentor." } : { ok: true, text: `Invite sent to ${app.email}.` });
      onInvited();
    }
    load();
  }

  const list = (apps || []).filter((a) => a.status === tab);
  const count = (k: string) => (apps || []).filter((a) => a.status === k).length;

  return (
    <section className="stack-sm" id="applications">
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
        {apps && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No {tab.toLowerCase()} applications.</p>}
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
                <a href={`${a.resumeUrl}?download=1`} download={a.resumeName} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Download resume</a>
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

// ---------------- Custom service names from "Other" packages ----------------
function CustomServices() {
  const [services, setServices] = useState<any[] | null>(null);
  useEffect(() => {
    fetch("/api/admin/custom-services").then((r) => r.json()).then((d) => setServices(d.services || [])).catch(() => setServices([]));
  }, []);
  return (
    <section className="stack-sm">
      <h2 style={{ fontSize: 30 }}>Custom services</h2>
      <p className="text-secondary">What mentors typed when they picked &quot;Other&quot;. If several mentors offer the same thing, it may be worth adding as an official service.</p>
      <div className="card" style={{ padding: "6px 20px" }}>
        {services === null && <p className="text-muted" style={{ padding: "12px 0" }}>Loading…</p>}
        {services?.length === 0 && <p className="text-muted" style={{ padding: "12px 0" }}>No &quot;Other&quot; packages yet.</p>}
        {services?.map((s) => (
          <details key={s.name} className="list-row" style={{ display: "block" }}>
            <summary className="between" style={{ cursor: "pointer" }}>
              <b style={{ fontSize: 15 }}>{s.name}</b>
              <span className="text-muted">{s.mentors} mentor{s.mentors === 1 ? "" : "s"} · {s.packages} package{s.packages === 1 ? "" : "s"}</span>
            </summary>
            <div className="stack-sm" style={{ padding: "8px 0 4px" }}>
              {s.examples.map((e: any) => (
                <Link key={e.id} href={`/mentors/${e.sellerId}#pkg-${e.id}`} className="link small">
                  {e.title} ({e.mentor})
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------- People: mentors & students ----------------
function People() {
  const [role, setRole] = useState<"SELLER" | "BUYER">("SELLER");
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[] | null>(null);
  const [counts, setCounts] = useState<{ mentors: number; students: number } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

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

  async function act(u: any, action: string) {
    let reason: string | undefined;
    if (action === "remove") {
      const r = prompt(`Remove ${u.name}? They'll be hidden from the site and can't log in. Reason (kept on record):`);
      if (r === null) return;
      if (!r.trim()) return alert("A reason is required.");
      reason = r;
    } else if (action === "pause") {
      const r = prompt(
        `Pause ${u.name} pending review? ${u.role === "SELLER" ? "They'll be hidden from search and can't unpause themselves." : "They won't be able to send messages."} They get an email. Reason (kept on record):`
      );
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || "Couldn't update");
    if (action === "remove" && d.activeOrders > 0) {
      alert(`Done. ${u.name} has ${d.activeOrders} active order${d.activeOrders === 1 ? "" : "s"}. Open each one to refund or release it.`);
    }
    load();
  }

  return (
    <section className="stack-sm">
      <h2 style={{ fontSize: 30 }}>People</h2>
      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={role === "SELLER"} onClick={() => setRole("SELLER")}>
          Mentors {counts && <span className="tab-count">{counts.mentors}</span>}
        </button>
        <button role="tab" className="tab" aria-selected={role === "BUYER"} onClick={() => setRole("BUYER")}>
          Students {counts && <span className="tab-count">{counts.students}</span>}
        </button>
      </div>
      <input className="input" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      <div className="card" style={{ padding: "4px 20px" }}>
        {users === null && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {users?.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No one found.</p>}
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
      {isMentor && (
        <>
          <div className="row-wrap small">
            {u.credential && <span><b>Credential:</b> {u.credential}</span>}
            {u.mentorStage && <span className="badge">{labelFor(STAGES, u.mentorStage)}</span>}
            {u.schoolType && <span className="badge">{labelFor(SCHOOL_TYPES, u.schoolType)}</span>}
            {(u.backgrounds || []).map((b: string) => <span key={b} className="badge">{labelFor(BACKGROUNDS, b)}</span>)}
            {d.rating?.count > 0 && <span>★ {d.rating.avg?.toFixed(1)} ({d.rating.count})</span>}
            <span>{u.hasAvailability ? "Call hours set" : "No call hours"}{u.timeZone ? ` · ${u.timeZone}` : ""}{u.externalCalConnected ? " · Own calendar connected" : ""}</span>
          </div>
          {u.bio && <p className="text-secondary small" style={{ whiteSpace: "pre-wrap" }}>{u.bio}</p>}
          <div className="row-wrap small">
            {u.gigs.map((g: any) => <span key={g.id} className="badge badge-brand">{g.title} · {money(g.price)}</span>)}
          </div>
          <Link href={`/mentors/${u.id}`} className="link small">Open public profile →</Link>
        </>
      )}
      <b className="small" style={{ marginTop: 6 }}>Recent orders</b>
      {d.orders.length === 0 && <span className="text-muted">No orders.</span>}
      {d.orders.map((o: any) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="between small" style={{ gap: 10 }}>
          <span className="grow">{o.gig.title} · {isMentor ? o.buyer.name : o.seller.name}</span>
          <span>{money(o.amount)}</span>
          {statusBadge(o)}
        </Link>
      ))}
    </div>
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

// Needs its own useDisputeThread() call, so it can't live inline in a .map().
function DisputeCard({ order, onResolved }: { order: any; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { messages, sendMessage } = useDisputeThread(expanded ? order.id : "");
  const [draft, setDraft] = useState("");

  async function resolve(kind: "refund" | "release") {
    const text = kind === "refund" ? `Refund ${money(order.amount)} to ${order.buyer.name}?` : `Release payment to ${order.seller.name}?`;
    if (!confirm(text)) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}/${kind}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "That didn't work");
    onResolved();
  }

  return (
    <div className="card stack-sm" style={{ padding: 20 }}>
      <div className="between">
        <b>{order.gig.title}</b>
        <b>{money(order.amount)}</b>
      </div>
      <span className="text-secondary small">
        {order.buyer.name} ({order.buyer.email}) vs. {order.seller.name} ({order.seller.email})
      </span>
      <p className="small" style={{ fontStyle: "italic" }}>&ldquo;{order.disputeReason}&rdquo;</p>
      {(order.deliveries || []).length > 0 ? (
        <details className="collapse">
          <summary>
            <span className="row" style={{ gap: 8 }}>What the mentor delivered <span className="tab-count">{order.deliveries.length}</span></span>
          </summary>
          <div className="collapse-body">
            {order.deliveries.map((d: any, i: number) => (
              <DeliveryCard key={d.id} delivery={d} latest={i === order.deliveries.length - 1 && order.deliveries.length > 1} />
            ))}
          </div>
        </details>
      ) : (
        <span className="text-muted small">Nothing delivered through the site yet.</span>
      )}
      <div className="row-wrap">
        <button onClick={() => setExpanded((e) => !e)} className="btn btn-sm">{expanded ? "Hide conversation" : "Respond / ask for details"}</button>
        <Link href={`/orders/${order.id}`} className="btn btn-sm">Open order</Link>
        <span style={{ marginLeft: "auto" }} className="row">
          <button onClick={() => resolve("refund")} disabled={busy} className="btn btn-sm btn-danger">Refund student</button>
          <button onClick={() => resolve("release")} disabled={busy} className="btn btn-sm btn-deep">Release to mentor</button>
        </span>
      </div>
      {expanded && (
        <div className="msg-thread">
          {messages.length === 0 && <p className="text-muted">Loading…</p>}
          {messages.map((m: any) => (
            <div key={m.id} className={`msg-bubble ${m.sender?.role === "ADMIN" ? "msg-mine" : "msg-theirs"}`}>
              <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>{m.sender?.name} {m.sender?.role === "ADMIN" ? <StaffBadge /> : `(${m.sender?.role === "SELLER" ? "mentor" : "student"})`}</div>
              {m.body}
            </div>
          ))}
          <div className="row">
            <input className="input grow" style={{ marginBottom: 0 }} placeholder="Ask a follow-up question…" value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { sendMessage(draft); setDraft(""); } }} />
            <button className="btn" onClick={() => { if (draft.trim()) { sendMessage(draft); setDraft(""); } }}>Send</button>
          </div>
        </div>
      )}
      <span className="text-muted">Nothing happens automatically. Payment stays held until you choose.</span>
    </div>
  );
}
