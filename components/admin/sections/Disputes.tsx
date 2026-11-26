"use client";

import { useState } from "react";
import Link from "next/link";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { Collapsible, EmptyState, Field, LoadingBlock, StaffBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { fmtDay } from "@/lib/format";
import { DeliveryCard } from "@/components/Deliveries";
import { money } from "@/lib/options";
import { shortHours } from "@/lib/hours";
import { useAdminCan } from "@/components/admin/AdminShell";
import { useConfirm } from "@/components/ConfirmDialog";

// Admin -> Disputes & flags: open and resolved disputes. Refunding or
// releasing moves money, so those buttons need the Orders permission.
// Hours packages (redesign Oct 2026) are refunded as MentorsMD credit (full
// or partial), never to the card; their hours are held back from the
// mentor's monthly payout until the dispute is decided.
export function Disputes({ disputes, onResolved }: { disputes: { open: any[]; resolved: any[] }; onResolved: () => void }) {
  // Same control as Flags above it: tabs with a count on each.
  const [view, setView] = useState<"open" | "resolved">("open");
  return (
    <section className="stack-sm" id="disputes">
      <h2 className="block-title">Disputes</h2>
      <div className="tabs adm-tabs-inline" role="tablist" aria-label="Disputes">
        <button type="button" role="tab" className="tab" aria-selected={view === "open"} onClick={() => setView("open")}>
          Pending <span className="tab-count">{disputes.open.length}</span>
        </button>
        <button type="button" role="tab" className="tab" aria-selected={view === "resolved"} onClick={() => setView("resolved")}>
          Resolved <span className="tab-count">{disputes.resolved.length}</span>
        </button>
      </div>
      {view === "open" && (
        <>
          {disputes.open.length === 0 && <EmptyState>No open disputes.</EmptyState>}
          {disputes.open.map((o) => (
            <DisputeCard key={o.id} order={o} onResolved={onResolved} />
          ))}
        </>
      )}
      {view === "resolved" && (
        <>
          {disputes.resolved.length === 0 && <EmptyState>Nothing resolved yet.</EmptyState>}
          {disputes.resolved.length > 0 && (
            <div className="card" style={{ padding: "6px 20px" }}>
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
          )}
        </>
      )}
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

// Hours packages: refund as credit, full or partial, in a pop-up.
function CreditRefund({ order, onDone }: { order: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState(((order.refundableCents || 0) / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cents = Math.round(Number(dollars) * 100);
  const full = cents === order.refundableCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!Number.isFinite(cents) || cents < 1) return setError("Enter an amount.");
    if (cents > order.refundableCents) return setError(`At most ${money(order.refundableCents)}.`);
    setBusy(true);
    const res = await fetch(`/api/orders/${order.id}/credit-refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents, note }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "That didn't work");
    setOpen(false);
    onDone();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-sm btn-danger">Refund as credit</button>
      <Modal open={open} onClose={() => setOpen(false)} label="Refund as MentorsMD credit" dismissable={!busy}>
        <form className="stack-sm" onSubmit={submit}>
          <h2 className="modal-title">Refund as MentorsMD credit?</h2>
          <p className="text-secondary small">{order.title || order.gig.title}: {order.buyer.name} (student) and {order.seller.name} (mentor).</p>
          <Field id={`refund-amount-${order.id}`} label="Amount" help={`Up to ${money(order.refundableCents)}: the price plus added hours, including any credit they used.`}>
            <input id={`refund-amount-${order.id}`} className="input" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value.replace(/[^0-9.]/g, ""))} style={{ marginBottom: 0, maxWidth: 160 }} />
          </Field>
          <Field id={`refund-note-${order.id}`} label="Note to the student" optional help="In their email.">
            <input id={`refund-note-${order.id}`} className="input" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Refunded as credit to settle your dispute." style={{ marginBottom: 0 }} />
          </Field>
          <span className="text-muted small">
            {full
              ? `Full refund: everything they paid goes back to ${order.buyer.name} as credit. The package is marked Refunded, its calls are cancelled, and nothing more is paid to ${order.seller.name}.`
              : `Partial refund: the package is approved and closed; ${order.seller.name}'s last payout for it is their unpaid and unused hours minus this refund (hours already paid in earlier months aren't taken back).`}
          </span>
          {error && <div role="alert" className="alert alert-danger small">{error}</div>}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? "Working…" : `Refund ${Number.isFinite(cents) && cents > 0 ? money(cents) : ""} as credit`}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// Needs its own useDisputeThread() call, so it can't live inline in a .map().
function DisputeCard({ order, onResolved }: { order: any; onResolved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const { messages, sendMessage } = useDisputeThread(expanded ? order.id : "");
  const [draft, setDraft] = useState("");
  const canMoveMoney = useAdminCan("orders");
  const { ask, dialog } = useConfirm();

  async function resolve(kind: "refund" | "release") {
    const text =
      kind === "refund"
        ? `Refund ${money(order.amount)} to ${order.buyer.name}?`
        : order.kind
        ? `Approve the package for ${order.seller.name}? Their hours (including unused ones) are paid with the next monthly payout.`
        : `Release payment to ${order.seller.name}?`;
    setBusy(true);
    const done = await ask({
      title: kind === "refund" ? "Refund the student?" : order.kind ? "Approve for the mentor?" : "Release to the mentor?",
      body: text,
      confirmLabel: kind === "refund" ? "Refund" : order.kind ? "Approve" : "Release",
      danger: kind === "refund",
      run: async () => {
        const res = await fetch(`/api/orders/${order.id}/${kind}`, { method: "POST" });
        if (!res.ok) return (await res.json().catch(() => ({}))).error || "That didn't work";
      },
    });
    setBusy(false);
    if (done !== null) onResolved();
  }

  return (
    <div className="card stack-sm" style={{ padding: 20 }}>
      {dialog}
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
        <Collapsible title="What the mentor delivered" count={order.deliveries.length}>
          {order.deliveries.map((d: any, i: number) => (
            <DeliveryCard key={d.id} delivery={d} latest={i === order.deliveries.length - 1 && order.deliveries.length > 1} />
          ))}
        </Collapsible>
      ) : (
        <span className="text-muted small">Nothing delivered through the site yet.</span>
      )}
      <div className="row-wrap">
        <button type="button" onClick={() => setExpanded((e) => !e)} className="btn btn-sm toggle-btn" aria-expanded={expanded} aria-controls={`dispute-thread-${order.id}`}>{expanded ? "Hide conversation" : "Show conversation"}</button>
        <Link href={`/orders/${order.id}`} className="btn btn-sm">Open order</Link>
        {canMoveMoney && order.kind ? (
          <span style={{ marginLeft: "auto" }} className="row-wrap">
            <CreditRefund order={order} onDone={onResolved} />
            <button onClick={() => resolve("release")} disabled={busy} className="btn btn-sm btn-primary">Approve for the mentor</button>
          </span>
        ) : (
          <span style={{ marginLeft: "auto" }} className="text-muted small">Refunds and releases need the Orders permission.</span>
        )}
      </div>
      {expanded && (
        <div id={`dispute-thread-${order.id}`} className="msg-thread">
          {messages.length === 0 && <LoadingBlock lines={2} title={false} />}
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
