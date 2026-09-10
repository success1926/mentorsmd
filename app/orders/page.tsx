"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function OrdersPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [view, setView] = useState<"orders" | "messages">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/orders").then((res) => res.json()),
      fetch("/api/conversations").then((res) => res.json()),
    ]).then(([ordersData, convosData]) => {
      setOrders(ordersData.orders || []);
      setConversations(convosData.conversations || []);
      setLoaded(true);
    });
  }, []);

  return (
    <div>
      <div style={{ display: "flex", border: "1px solid #D8E2DC", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <button
          onClick={() => setView("orders")}
          style={{
            flex: 1,
            padding: "12px 0",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            background: view === "orders" ? "#1E5631" : "#F3F6F4",
            color: view === "orders" ? "#fff" : "#33413A",
          }}
        >
          Orders ({orders.length})
        </button>
        <button
          onClick={() => setView("messages")}
          style={{
            flex: 1,
            padding: "12px 0",
            border: "none",
            borderLeft: "1px solid #D8E2DC",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            background: view === "messages" ? "#1E5631" : "#F3F6F4",
            color: view === "messages" ? "#fff" : "#33413A",
          }}
        >
          Messages ({conversations.length})
        </button>
      </div>

      {!loaded && <p className="text-muted">Loading...</p>}

      {loaded && view === "orders" && (
        <div style={{ display: "grid", gap: 12 }}>
          {orders.length === 0 && <p className="text-muted">No orders yet.</p>}
          {orders.map((o: any) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{o.gig.title}</div>
                <div className="text-secondary">{o.buyer?.name} with {o.seller?.name} · ${(o.amount / 100).toFixed(2)}</div>
              </div>
              <span className={`badge ${o.status === "RELEASED" ? "badge-success" : "badge-warning"}`}>
                {o.status === "RELEASED" ? "Released" :
                 o.status === "REFUNDED" ? "Refunded" :
                 o.status === "COMPLETED" ? "Awaiting review" :
                 "Pending"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {loaded && view === "messages" && (
        <div style={{ display: "grid", gap: 12 }}>
          {conversations.length === 0 && <p className="text-muted">No conversations yet.</p>}
          {conversations.map((c: any) => {
            // The OTHER person in the conversation, not always "seller" -
            // if I'm the seller here, I want to see the buyer's info.
            const counterpart = role === "SELLER" ? c.buyer : c.seller;
            const lastMessage = c.messages?.[0];
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{counterpart?.name}</div>
                  {counterpart?.credential && <div className="text-secondary" style={{ marginTop: 2 }}>{counterpart.credential}</div>}
                  {lastMessage && (
                    <div className="text-muted" style={{ marginTop: 4, maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lastMessage.body}
                    </div>
                  )}
                </div>
                <span className="btn">Continue</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
