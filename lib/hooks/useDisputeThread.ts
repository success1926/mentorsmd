"use client";

import { useEffect, useState } from "react";
import PusherClient from "pusher-js";

// Same pattern as useConversation, but for the separate dispute thread on
// an order - different endpoint, different Pusher channel, different
// participant set (buyer, seller, and any admin, rather than just two
// fixed people).
export function useDisputeThread(orderId: string) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/${orderId}/dispute-messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []));

    const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusherClient.subscribe(`private-dispute-${orderId}`);
    channel.bind("new-message", (message: any) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      pusherClient.unsubscribe(`private-dispute-${orderId}`);
      pusherClient.disconnect();
    };
  }, [orderId]);

  async function sendMessage(body: string) {
    await fetch(`/api/orders/${orderId}/dispute-messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
  }

  return { messages, sendMessage };
}
