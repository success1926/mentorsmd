"use client";

import { useEffect, useState } from "react";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";

export default function AdminPage() {
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [earnings, setEarnings] = useState<any>(null);

  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [newCode, setNewCode] = useState({ code: "", percentOff: "", amountOffDollars: "" });
  const [creatingCode, setCreatingCode] = useState(false);

  const [disputedOrders, setDisputedOrders] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedDisputeId, setExpandedDisputeId] = useState<string | null>(null);

  function loadInvites() {
    fetch("/api/invites").then((res) => res.json()).then((data) => setInvites(data.invites || []));
  }
  function loadDiscountCodes() {
    fetch("/api/discount-codes").then((res) => res.json()).then((data) => setDiscountCodes(data.discountCodes || []));
  }
  function loadDisputedOrders() {
    fetch("/api/admin/disputed-orders").then((res) => res.json()).then((data) => setDisputedOrders(data.orders || []));
  }

  useEffect(() => {
    loadInvites();
    loadDiscountCodes();
    loadDisputedOrders();
    fetch("/api/admin/earnings").then((res) => res.json()).then(setEarnings);
  }, []);

  async function createInvite() {
    if (!email.trim()) return;
    setCreating(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setCreating(false);
    setEmail("");
    if (data.emailSent === false) alert("Invite created but the email failed to send — try resending it.");
    loadInvites();
  }

  async function resend(id: string) {
    await fetch(`/api/invites/${id}/resend`, { method: "POST" });
    alert("Invite email re-sent.");
  }

  async function createDiscountCode() {
    if (!newCode.code.trim() || (!newCode.percentOff && !newCode.amountOffDollars)) return;
    setCreatingCode(true);
    await fetch("/api/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCode),
    });
    setNewCode({ code: "", percentOff: "", amountOffDollars: "" });
    setCreatingCode(false);
    loadDiscountCodes();
  }

  async function refundOrder(orderId: string) {
    setResolvingId(orderId);
    const res = await fetch(`/api/orders/${orderId}/refund`, { method: "POST" });
    if (res.ok) loadDisputedOrders();
    else alert((await res.json()).error || "Refund failed");
    setResolvingId(null);
  }

  async function releaseOrder(orderId: string) {
    setResolvingId(orderId);
    const res = await fetch(`/api/orders/${orderId}/release`, { method: "POST" });
    if (res.ok) loadDisputedOrders();
    else alert((await res.json()).error || "Release failed");
    setResolvingId(null);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Admin</h1>

      {earnings && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            ["Total collected", earnings.totalCollectedCents],
            ["Your 20% cut", earnings.platformCutCents],
            ["Paid to coaches", earnings.paidToSellersCents],
            ["Pending", earnings.inEscrowCents],
          ].map(([label, cents]: any) => (
            <div key={label} style={{ background: "#F3F6F4", borderRadius: 8, padding: 16 }}>
              <div className="text-secondary" style={{ marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>${(cents / 100).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Disputed orders - the resolution queue */}
      {disputedOrders.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Disputed orders awaiting resolution</div>
          <div style={{ display: "grid", gap: 10 }}>
            {disputedOrders.map((o) => (
              <DisputeCard
                key={o.id}
                order={o}
                expanded={expandedDisputeId === o.id}
                onToggle={() => setExpandedDisputeId(expandedDisputeId === o.id ? null : o.id)}
                onRefund={() => refundOrder(o.id)}
                onRelease={() => releaseOrder(o.id)}
                resolving={resolvingId === o.id}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Invite a coach</div>
        <p className="text-secondary" style={{ marginBottom: 14 }}>
          Generates a one-time link and emails it directly — nothing for you to copy or send yourself.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" style={{ marginBottom: 0, flex: 1 }} placeholder="Coach's email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={createInvite} disabled={creating} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
            {creating ? "Sending..." : "Send invite"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
        {invites.length === 0 && <p className="text-muted">No invites yet.</p>}
        {invites.map((inv: any) => (
          <div key={inv.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div>
              <div style={{ fontSize: 14 }}>{inv.email}</div>
              <div className="text-muted" style={{ fontFamily: "monospace" }}>{inv.code}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {inv.status === "REDEEMED" ? (
                <span className="badge badge-success">Redeemed</span>
              ) : (
                <>
                  <span className="badge badge-warning">{inv.status}</span>
                  <button onClick={() => resend(inv.id)} className="btn">Resend</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Discount codes */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Create a discount code</div>
        <p className="text-secondary" style={{ marginBottom: 14 }}>
          Set either a percent off or a dollar amount off, not both. Note: discount codes aren't currently
          applied at checkout (that field was removed) - this section is left in case you want to bring it
          back later.
        </p>
        <input className="input" placeholder="Code (e.g. WELCOME10)" value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input className="input" style={{ marginBottom: 0 }} placeholder="Percent off (e.g. 10)" value={newCode.percentOff} onChange={(e) => setNewCode({ ...newCode, percentOff: e.target.value, amountOffDollars: "" })} />
          <input className="input" style={{ marginBottom: 0 }} placeholder="or $ off (e.g. 5)" value={newCode.amountOffDollars} onChange={(e) => setNewCode({ ...newCode, amountOffDollars: e.target.value, percentOff: "" })} />
        </div>
        <button onClick={createDiscountCode} disabled={creatingCode} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
          {creatingCode ? "Creating..." : "Create code"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {discountCodes.length === 0 && <p className="text-muted">No discount codes yet.</p>}
        {discountCodes.map((d) => (
          <div key={d.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
            <div>
              <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{d.code}</div>
              <div className="text-muted">
                {d.percentOff ? `${d.percentOff}% off` : `$${(d.amountOffCents / 100).toFixed(2)} off`} · used {d.redemptions}{d.maxRedemptions ? ` / ${d.maxRedemptions}` : ""} times
              </div>
            </div>
            <span className={`badge ${d.active ? "badge-success" : "badge-warning"}`}>{d.active ? "Active" : "Inactive"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Split out because it needs its own useDisputeThread() call, which
// can't happen conditionally inside a .map() in the parent.
function DisputeCard({
  order,
  expanded,
  onToggle,
  onRefund,
  onRelease,
  resolving,
}: {
  order: any;
  expanded: boolean;
  onToggle: () => void;
  onRefund: () => void;
  onRelease: () => void;
  resolving: boolean;
}) {
  const { messages, sendMessage } = useDisputeThread(expanded ? order.id : "");
  const [draft, setDraft] = useState("");

  async function handleSend() {
    if (!draft.trim()) return;
    await sendMessage(draft);
    setDraft("");
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <b>{order.gig.title}</b>
        <span>${(order.amount / 100).toFixed(2)}</span>
      </div>
      <div className="text-secondary" style={{ marginBottom: 8 }}>
        {order.buyer.name} ({order.buyer.email}) vs. {order.seller.name} ({order.seller.email})
      </div>
      <p className="text-secondary" style={{ marginBottom: 12 }}>"{order.disputeReason}"</p>

      <button onClick={onToggle} className="btn" style={{ width: "100%", marginBottom: 12 }}>
        {expanded ? "Hide conversation" : "Respond / get more details"}
      </button>

      {expanded && (
        <div className="msg-thread" style={{ marginBottom: 12 }}>
          {messages.length === 0 && <p className="text-muted">Loading...</p>}
          {messages.map((m: any) => (
            <div key={m.id} className={`msg-bubble ${m.sender?.role === "ADMIN" ? "msg-buyer" : "msg-seller"}`}>
              <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{m.sender?.name} ({m.sender?.role})</div>
              {m.body}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Ask a follow-up question..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button onClick={handleSend} className="btn">Send</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onRefund} disabled={resolving} className="btn" style={{ background: "#DC2626", border: "none", color: "#fff", flex: 1 }}>
          Refund buyer
        </button>
        <button onClick={onRelease} disabled={resolving} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff", flex: 1 }}>
          Release to coach
        </button>
      </div>
      <p className="text-muted" style={{ textAlign: "center", marginTop: 8 }}>
        Nothing happens automatically - payment stays held until you choose one of these.
      </p>
    </div>
  );
}
