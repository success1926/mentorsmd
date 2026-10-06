"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { statusBadge, tintFor, initialsOf } from "@/components/ui";
import { callSummary, fmtDateTime } from "@/lib/calls";
import { money } from "@/lib/options";

const ACTIVE = ["IN_ESCROW", "COMPLETED"];

// What the viewer should do next on an order, in one line.
function nextStep(o: any, isSeller: boolean) {
  const calls = callSummary(o);
  if (o.disputed && ACTIVE.includes(o.status)) return "An admin is reviewing this order.";
  if (o.status === "IN_ESCROW") {
    if (calls.onHold) return isSeller ? "On hold: the student hasn't booked the call." : "Book your call or tell us you don't need it.";
    if (calls.upcoming[0]) return `Call on ${fmtDateTime(calls.upcoming[0].startTime)}`;
    if (calls.canBook) return isSeller ? "Waiting for the student to book a call." : "Book your call.";
    if (o.revisionRequested) return isSeller ? "Revision requested." : "Revision requested. Your mentor is on it.";
    return isSeller ? "Deliver the work, then mark it complete." : "Your mentor is working on it.";
  }
  if (o.status === "COMPLETED") return isSeller ? "Delivered. Waiting for the student to approve." : "Delivered. Review it and release payment.";
  if (o.status === "RELEASED" && !isSeller && !o.review) return "Leave a review.";
  return "";
}

export default function OrdersPage() {
  const { data: session } = useSession();
  const isSeller = (session?.user as any)?.role === "SELLER";
  const [orders, setOrders] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders((d.orders || []).filter((o: any) => o.status !== "PENDING_PAYMENT" && o.status !== "CANCELLED")))
      .catch(() => setOrders([]));
    fetch("/api/me/nav")
      .then((r) => r.json())
      .then((d) => setUnread(d.unread || 0))
      .catch(() => {});
  }, []);

  const active = (orders || []).filter((o) => ACTIVE.includes(o.status));
  const done = (orders || []).filter((o) => !ACTIVE.includes(o.status));
  const list = tab === "active" ? active : done;

  return (
    <div className="page-mid">
      <div className="between" style={{ marginBottom: 24, flexWrap: "wrap" }}>
        <h1 className="page-title">{isSeller ? "Orders" : "My orders"}</h1>
        {!isSeller && <Link href="/mentors" className="btn btn-primary">Find a mentor</Link>}
      </div>

      {unread > 0 && (
        <div className="alert row" style={{ marginBottom: 20, alignItems: "center" }}>
          <span className="count-badge" style={{ marginLeft: 0 }}>{unread > 99 ? "99+" : unread}</span>
          <span className="grow">
            You have <b>{unread} unread message{unread === 1 ? "" : "s"}</b>.
          </span>
          <Link href="/messages" className="btn btn-sm">Open messages</Link>
        </div>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" className="tab" aria-selected={tab === "active"} onClick={() => setTab("active")}>
          In progress <span className="tab-count">{active.length}</span>
        </button>
        <button role="tab" className="tab" aria-selected={tab === "done"} onClick={() => setTab("done")}>
          Completed <span className="tab-count">{done.length}</span>
        </button>
      </div>

      {orders === null && <p className="text-muted">Loading…</p>}
      {orders !== null && list.length === 0 && (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <span>{tab === "active" ? "No orders in progress." : "No completed orders yet."}</span>
          {!isSeller && tab === "active" && <Link href="/mentors" className="btn btn-primary">Browse mentors</Link>}
        </div>
      )}

      <div className="stack">
        {list.map((o) => {
          const other = isSeller ? o.buyer : o.seller;
          const step = nextStep(o, isSeller);
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="card row" style={{ gap: 16, alignItems: "flex-start" }}>
              {other?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.photoUrl} alt="" className="avatar" style={{ objectFit: "cover" }} />
              ) : (
                <span className="avatar" style={{ background: tintFor(other?.name || "") }}>{initialsOf(other?.name || "")}</span>
              )}
              <div className="grow stack-sm" style={{ gap: 4 }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <b style={{ fontSize: 17 }}>{o.gig.title}</b>
                  <b className="nowrap">{money(o.amount)}</b>
                </div>
                <span className="text-secondary">
                  {isSeller ? "Student" : "Mentor"}: {other?.name}
                  {o.dueDate ? ` · Due ${new Date(o.dueDate).toLocaleDateString()}` : ""}
                </span>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  {statusBadge(o)}
                  {step && <span className="text-muted">{step}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
