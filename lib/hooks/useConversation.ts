"use client";

import { useEffect, useRef, useState } from "react";
import { isLive, onLive } from "@/lib/realtimeClient";
import { uploadFile } from "@/lib/upload";

// Drop this into any order/thread page: const { messages, sendMessage } =
// useConversation(conversationId). It loads history once, then keeps the
// list updated in real time as new messages arrive over Supabase Realtime
// (lib/realtimeClient.ts) - no manual refresh. If live updates aren't
// available, it checks for new messages every 20 seconds instead.
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

// Adds a message unless it's already in the list.
function addMessage(list: any[], message: any) {
  return list.some((m) => m.id === message.id) ? list : [...list, message];
}

// orderId (redesign Oct 2026): a package's own thread. Only that package's
// messages are shown, and messages sent are tagged with it.
export function useConversation(conversationId: string, orderId?: string) {
  const [messages, setMessages] = useState<any[]>([]);
  // The last uploaded file, so "Send anyway" after a warning doesn't
  // upload the same file twice.
  const lastUpload = useRef<{ file: File; path: string; name: string } | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;

    // Loading the thread also marks it read on the server.
    const load = () =>
      fetch(`/api/conversations/${conversationId}/messages${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (!alive) return;
          setMessages(data.messages || []);
          notifyUnreadChanged();
        })
        .catch(() => {});
    load();

    const off = onLive((event, payload) => {
      if (event !== "message" || payload?.conversationId !== conversationId || !payload.message) return;
      if (orderId && payload.message.orderId !== orderId) return;
      setMessages((prev) => addMessage(prev, payload.message));
      // The thread is open on screen, so this message counts as read.
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetch(`/api/conversations/${conversationId}/read`, { method: "POST" })
          .then(notifyUnreadChanged)
          .catch(() => {});
      }
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
  }, [conversationId, orderId]);

  async function sendMessage(body: string, file?: File, opts: { acknowledgeWarnings?: boolean } = {}) {
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;

    if (file && lastUpload.current?.file === file) {
      attachmentUrl = lastUpload.current.path;
      attachmentName = lastUpload.current.name;
    } else if (file) {
      try {
        const up = await uploadFile("/api/upload", file, { conversationId });
        attachmentUrl = up.path;
        attachmentName = up.name;
        lastUpload.current = { file, path: up.path, name: up.name };
      } catch (err: any) {
        // Stop here (and keep the draft) rather than silently sending the
        // message without the file.
        alert(err?.message || "That file couldn't be uploaded");
        throw err;
      }
    }

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, attachmentUrl, attachmentName, acknowledgeWarnings: !!opts.acknowledgeWarnings, orderId: orderId || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (INLINE_CODES.includes(data.code)) throw new SendError(data.error || "Message not sent", data);
      alert(data.error || "Message failed to send");
      throw new Error(data.error || "Send failed");
    }
    lastUpload.current = null;
    // Show it straight away. The live update brings the same message back
    // (and to the other person); addMessage skips the duplicate.
    const data = await res.json().catch(() => ({}));
    if (data.message) setMessages((prev) => addMessage(prev, data.message));
  }

  return { messages, sendMessage };
}
