"use client";

import { useEffect, useState } from "react";
import { isLive, onLive } from "@/lib/realtimeClient";

// Same pattern as useConversation, but for the separate dispute thread on
// an order - different endpoint, different live event ("dispute-message"),
// different participant set (student, mentor, and the admins who handle
// disputes, rather than just two fixed people).
export function useDisputeThread(orderId: string) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;

    const load = () =>
      fetch(`/api/orders/${orderId}/dispute-messages`)
        .then((res) => res.json())
        .then((data) => alive && setMessages(data.messages || []))
        .catch(() => {});
    load();

    const off = onLive((event, payload) => {
      if (event !== "dispute-message" || payload?.orderId !== orderId || !payload.message) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]));
    });

    // Fallback when live updates aren't connected.
    const timer = setInterval(() => {
      if (!isLive() && document.visibilityState === "visible") load();
    }, 20_000);

    return () => {
      alive = false;
      off();
      clearInterval(timer);
    };
  }, [orderId]);

  async function sendMessage(body: string) {
    const res = await fetch(`/api/orders/${orderId}/dispute-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.message) setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
  }

  return { messages, sendMessage };
}
