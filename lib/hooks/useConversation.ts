"use client";

import { useEffect, useState } from "react";
import PusherClient from "pusher-js";

// Drop this into any order/thread page: const { messages, sendMessage } =
// useConversation(conversationId). It loads history once, then keeps the
// list updated in real time as new messages arrive over Pusher - no
// polling, no manual refresh.
export function useConversation(conversationId: string) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []));

    const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusherClient.subscribe(`private-conversation-${conversationId}`);
    channel.bind("new-message", (message: any) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      pusherClient.unsubscribe(`private-conversation-${conversationId}`);
      pusherClient.disconnect();
    };
  }, [conversationId]);

  async function sendMessage(body: string, file?: File) {
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        // Stop here (and keep the draft) rather than silently sending the
        // message without the file.
        alert(uploadData.error || "That file couldn't be uploaded");
        throw new Error(uploadData.error || "Upload failed");
      }
      attachmentUrl = uploadData.url;
      attachmentName = uploadData.name;
    }

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, attachmentUrl, attachmentName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Message failed to send");
      throw new Error(data.error || "Send failed");
    }
    // No need to manually add the message to state here - the Pusher
    // event above will deliver it back to us (and to the other person)
    // the moment the server broadcasts it.
  }

  return { messages, sendMessage };
}
