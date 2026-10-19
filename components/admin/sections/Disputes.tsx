"use client";

import { useState } from "react";
import Link from "next/link";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { StaffBadge } from "@/components/ui";
import { DeliveryCard } from "@/components/Deliveries";
import { money } from "@/lib/options";
import { shortHours } from "@/lib/hours";
import { useAdminCan } from "@/components/admin/AdminShell";

// Admin -> Disputes & flags: open and resolved disputes. Refunding or
// releasing moves money, so those buttons need the Orders permission.
// Hours packages (redesign Oct 2026) are refunded as MentorsMD credit (full
// or partial), never to the card; their hours are held back from the
// mentor's monthly payout until the dispute is decided.
const fmtDay = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function Disputes({ disputes, onResolved }: { disputes: { open: any[]; resolved: any[] }; onResolved: () => void }) {
  return (
    <section className="stack-sm" id="disputes">
      <h2 style={{ fontSize: 30 }}>Disputes</h2>
      <details className="collapse" open={disputes.open.length > 0}>
        <summary>
          <span className="row" style={{ gap: 8 }}>Pending <span className="tab-count">{disputes.open.length}</span></span>
        </summary>
        <div className="collapse-body">
          {disputes.open.length === 0 && <span className="text-muted">No open disputes.</span>}
          {disputes.open.map((o) => (
            <DisputeCard key={o.id} order={o} onResolved={onResolved} />
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
                <b>{o.title || o.gig.title}</b>
                <span className="text-muted">{o.buyer.name} vs. {o.seller.name} · {money(o.paidCents ?? o.amount)}</span>
              </div>
              <ResolutionBadge o={o} />
              {o.disputeResolvedAt && <span className="text-muted">{fmtDay(o.disputeResolvedAt)}</span>}
              <Link href={`/orders/${o.id}`} className="btn btn-sm">View</Link>
            </div>
          ))}
        </div>
      </details>
      </section>
  );
}

function ResolutionBadge({ o }: { o: any }) {
  if (o.disputeResolution === "CREDIT") {
    return <span className="badge badge-pink">{o.status === "REFUNDED" ? "Refunded in full as credit" : "Partly refunded as credit"} ({money(o.refundedCreditCents || 0)})</span>;
  }
  if (o.status === "REFUNDED") return <span className="badge badge-pink">Refunded to student</span>;
  return <span className="badge badge-success">{o.kind ? "Approved for the mentor" : "Released to mentor"}</span>;
}

// Hours packages: refund as credit, full or partial.
function CreditRefund({ order, onDone }: { order: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState(((order.refundableCents || 0) / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cents = Math.round(Number(dollars) * 100);
  const full = cents === order.refundableCents;

  async function submit() {
    setError("");
    if (!Number.isFinite(cents) || cents < 1) return setError("Enter an amount.");
    if (cents > order.refundableCents) return setError(`At most ${money(order.refundableCents)}.`);
    const text = full
      ? `Refund ${money(cents)} (everything they paid) to ${order.buyer.name} as MentorsMD credit? The package is marked Refunded and nothing more is paid to ${order.seller.name}.`
      : `Refund ${money(cents)} to ${order.buyer.name} as MentorsMD credit? The package is approved, and ${money(cents)} is taken off what ${order.seller.name} is still owed for it.`;
    if (!confirm(text)) return;
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}/credit-refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents, note }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "That didn't work");
    onDone();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn btn-sm btn-danger">Refund as credit</button>;
  return (
    <div className="card stack-sm" style={{ padding: 14, width: "100%" }}>
      <b className="small">Refund as MentorsMD credit</b>
      <label className="small">
        Amount (up to {money(order.refundableCents)}: the price plus added hours, including any credit they used)
        <input className="input" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value.replace(/[^0-9.]/g, ""))} style={{ marginBottom: 0, maxWidth: 160 }} />
      </label>
      <label className="small">
        Note to the student (optional, in their email)
        <input className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Refunded as credit to settle your dispute." style={{ marginBottom: 0 }} />
      </label>
      <span className="text-muted small">
        {full
          ? "Full refund: the package is marked Refunded, its calls are cancelled, and nothing more is paid to the mentor."
          : "Partial refund: the package is approved and closed; the mentor's last payout for it is their unpaid and unused hours minus this refund (hours already paid in earlier months aren't taken back)."}
      </span>
      {error && <div role="alert" className="alert alert-danger small">{error}</div>}
      <div className="row">
        <button className="btn btn-sm btn-danger" disabled={busy} onClick={submit}>Refund {Number.isFinite(cents) && cents > 0 ? money(cents) : ""} as credit</button>
        <button className="btn btn-sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

// Needs its own useDisputeThread() call, so it can't live inline in a .map().
function DisputeCard({ order, onResolved }: { order: any; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { messages, sendMessage } = useDisputeThread(expanded ? order.id : "");
  const [draft, setDraft] = useState("");
  const canMoveMoney = useAdminCan("orders");

  async function resolve(kind: "refund" | "release") {
    const text =
      kind === "refund"
        ? `Refund ${money(order.amount)} to ${order.buyer.name}?`
        : order.kind
        ? `Approve the package for ${order.seller.name}? Their hours (including unused ones) are paid with the next monthly payout.`
        : `Release payment to ${order.seller.name}?`;
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
        <b>{order.title || order.gig.title}</b>
        <b>{money(order.paidCents ?? order.amount)}</b>
      </div>
      <span className="text-secondary small">
        {order.buyer.name} ({order.buyer.email}) vs. {order.seller.name} ({order.seller.email})
      </span>
      <p className="small" style={{ fontStyle: "italic" }}>&ldquo;{order.disputeReason}&rdquo;</p>
      {order.kind ? (
        <div className="row-wrap small text-secondary">
          <span><b>Hours:</b> {shortHours(order.hours.used)} used of {shortHours(order.hours.purchased)} ({shortHours(order.hours.left)} left)</span>
          {order.hours.paidMinutes > 0 && <span>{shortHours(order.hours.paidMinutes)} already paid to the mentor</span>}
          {order.topUpCents > 0 && <span>Added hours: {money(order.topUpCents)}</span>}
          {order.creditUsedCents > 0 && <span>Paid with credit: {money(order.creditUsedCents)}</span>}
          <span>Rate: {money(order.rateCents || 0)}/hr</span>
          <span className="text-muted">The hours are held back from the mentor&apos;s payout until you decide.</span>
        </div>
      ) : (order.deliveries || []).length > 0 ? (
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
        {canMoveMoney && order.kind ? (
          <span style={{ marginLeft: "auto" }} className="row-wrap">
            <CreditRefund order={order} onDone={onResolved} />
            <button onClick={() => resolve("release")} disabled={busy} className="btn btn-sm btn-deep">Approve for the mentor</button>
          </span>
        ) : canMoveMoney ? (
          <span style={{ marginLeft: "auto" }} className="row">
            <button onClick={() => resolve("refund")} disabled={busy} className="btn btn-sm btn-danger">Refund student</button>
            <button onClick={() => resolve("release")} disabled={busy} className="btn btn-sm btn-deep">Release to mentor</button>
          </span>
        ) : (
          <span style={{ marginLeft: "auto" }} className="text-muted small">Refunds and releases need the Orders permission.</span>
        )}
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
      <span className="text-muted">Nothing happens automatically. {order.kind ? "The mentor isn't paid for this package until you choose." : "Payment stays held until you choose."}</span>
    </div>
  );
}
