"use client";

import { useState } from "react";
import Link from "next/link";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { StaffBadge } from "@/components/ui";
import { DeliveryCard } from "@/components/Deliveries";
import { money } from "@/lib/options";
import { useAdminCan } from "@/components/admin/AdminShell";

// Admin -> Disputes & flags: open and resolved disputes. Refunding or
// releasing moves money, so those buttons need the Orders permission.
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
        {canMoveMoney ? (
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
      <span className="text-muted">Nothing happens automatically. Payment stays held until you choose.</span>
    </div>
  );
}
