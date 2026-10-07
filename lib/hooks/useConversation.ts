"use client";

import { useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";

// Drop this into any order/thread page: const { messages, sendMessage } =
// useConversation(conversationId). It loads history once, then keeps the
// list updated in real time as new messages arrive over Pusher - no
// polling, no manual refresh.
// Tells the top bar to refresh its unread badge.
export function notifyUnreadChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("mmd:unread-changed"));
}

// Errors the thread shows inline instead of a pop-up: a warning to
// confirm (off-site, ghostwriting, passwords), "confirm your email",
// blocked, paused.
export class SendError extends Error {
  constructor(message: string, public data: any) {
    super(message);
  }
}
const INLINE_CODES = ["WARNING", "EMAIL_UNVERIFIED", "BLOCKED_USER", "ON_HOLD", "BLOCKED", "LINKS_NEW_ACCOUNT", "LINK_SHORTENER", "LINK_UNSAFE"];

export function useConversation(conversationId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  // The last uploaded file, so "Send anyway" after a warning doesn't
  // upload the same file twice.
  const lastUpload = useRef<{ file: File; url: string; name: string } | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Loading the thread also marks it read on the server.
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages || []);
        notifyUnreadChanged();
      });

    const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusherClient.subscribe(`private-conversation-${conversationId}`);
    channel.bind("new-message", (message: any) => {
      setMessages((prev) => [...prev, message]);
      // The thread is open on screen, so this message counts as read.
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetch(`/api/conversations/${conversationId}/read`, { method: "POST" })
          .then(notifyUnreadChanged)
          .catch(() => {});
      }
    });

    return () => {
      pusherClient.unsubscribe(`private-conversation-${conversationId}`);
      pusherClient.disconnect();
    };
  }, [conversationId]);

  async function sendMessage(body: string, file?: File, opts: { acknowledgeWarnings?: boolean } = {}) {
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;

    if (file && lastUpload.current?.file === file) {
      attachmentUrl = lastUpload.current.url;
      attachmentName = lastUpload.current.name;
    } else if (file) {
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
      lastUpload.current = { file, url: uploadData.url, name: uploadData.name };
    }

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, attachmentUrl, attachmentName, acknowledgeWarnings: !!opts.acknowledgeWarnings }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (INLINE_CODES.includes(data.code)) throw new SendError(data.error || "Message not sent", data);
      alert(data.error || "Message failed to send");
      throw new Error(data.error || "Send failed");
    }
    lastUpload.current = null;
    // No need to manually add the message to state here - the Pusher
    // event above will deliver it back to us (and to the other person)
    // the moment the server broadcasts it.
  }

  return { messages, sendMessage };
}
