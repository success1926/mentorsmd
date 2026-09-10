"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConversation } from "@/lib/hooks/useConversation";

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY_REVIEW: "Essay review",
  MOCK_INTERVIEW: "Mock interview",
  APPLICATION_STRATEGY: "Application strategy",
  TUTORING: "Tutoring",
  OTHER: "Other",
};

export default function MessageThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [gigs, setGigs] = useState<any[]>([]);
  const [bookable, setBookable] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => setConversation(data.conversations?.find((c: any) => c.id === conversationId)));
  }, [conversationId]);

  const { messages, sendMessage } = useConversation(conversationId);
  const role = (session?.user as any)?.role;
  const isBuyer = role === "BUYER";

  useEffect(() => {
    if (!conversation || !isBuyer) return;
    fetch("/api/gigs")
      .then((res) => res.json())
      .then((data) => setGigs((data.gigs || []).filter((g: any) => g.seller.id === conversation.sellerId)));
    fetch(`/api/conversations/eligibility?sellerId=${conversation.sellerId}`)
      .then((res) => res.json())
      .then((data) => setBookable(!!data.canPickDueDate));
  }, [conversation, isBuyer]);

  async function handleSend() {
    if (!draft.trim() && !pendingFile) return;
    await sendMessage(draft, pendingFile || undefined);
    setDraft("");
    setPendingFile(null);
    if (conversation && isBuyer) {
      const elig = await fetch(`/api/conversations/eligibility?sellerId=${conversation.sellerId}`).then((r) => r.json());
      setBookable(!!elig.canPickDueDate);
    }
  }

  async function handleVideoCall() {
    setVideoLoading(true);
    const res = await fetch("/api/video/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    const data = await res.json();
    setVideoLoading(false);
    if (data.url) window.open(data.url, "_blank");
  }

  if (!conversation) return <p className="text-muted">Loading...</p>;

  const userId = (session?.user as any)?.id;
  const counterpart = role === "SELLER" ? conversation.buyer : conversation.seller;

  return (
    <div>
      <button onClick={() => router.push("/orders")} className="btn" style={{ marginBottom: 16, background: "none", border: "none", padding: 0 }}>
        &larr; Back to messages
      </button>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{counterpart?.name}</div>
        {counterpart?.credential && <div className="text-secondary">{counterpart.credential}</div>}
      </div>

      <div
        className="msg-thread"
        style={{ marginBottom: 14, borderColor: dragOver ? "#1E5631" : undefined, borderStyle: dragOver ? "dashed" : undefined, borderWidth: dragOver ? 2 : undefined }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) setPendingFile(file);
        }}
      >
        {messages.length === 0 && <p className="text-muted">No messages yet.</p>}
        {messages.map((m: any) => (
          <div key={m.id} className={`msg-bubble ${m.senderId === userId ? "msg-buyer" : "msg-seller"}`}>
            {m.body}
            {m.attachmentUrl && (
              <div style={{ marginTop: m.body ? 6 : 0 }}>
                <a href={`${m.attachmentUrl}?download=1`} download={m.attachmentName} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontSize: 13 }}>
                  📎 {m.attachmentName || "Attachment"}
                </a>
              </div>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
          />
          <button onClick={() => fileInputRef.current?.click()} className="btn" title="Attach a file">📎</button>
          <input
            className="input"
            style={{ marginBottom: 0, flex: 1 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Write a message..."
          />
          <button onClick={handleVideoCall} disabled={videoLoading} className="btn" title="Start a video call">
            {videoLoading ? "..." : "🎥"}
          </button>
          <button onClick={handleSend} className="btn">Send</button>
        </div>
        {pendingFile && (
          <div className="text-muted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            📎 {pendingFile.name}
            <button onClick={() => setPendingFile(null)} className="btn" style={{ padding: "2px 8px", fontSize: 11 }}>Remove</button>
          </div>
        )}
      </div>
      <p className="text-muted" style={{ marginTop: -10, marginBottom: 14 }}>Or drag a file anywhere in the box above to attach it.</p>

      {isBuyer && gigs.length > 0 && (
        <>
          {!bookable && (
            <div className="badge badge-warning" style={{ display: "block", marginBottom: 14, padding: "10px 14px" }}>
              Booking unlocks once {counterpart?.name?.split(" ")[0]} replies to your message.
            </div>
          )}
          <h2 style={{ fontSize: 15, color: "#5B6A61", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {counterpart?.name?.split(" ")[0]}'s packages
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {gigs.map((g) => (
              <div key={g.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{g.title}</div>
                      <span className="badge" style={{ background: "#EAF0EC", color: "#33413A" }}>{CATEGORY_LABELS[g.category] || g.category}</span>
                    </div>
                    <p className="text-secondary" style={{ margin: "0 0 4px", fontSize: 13 }}>{g.description}</p>
                    <div className="text-muted">{g.duration}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>${(g.price / 100).toFixed(0)}</div>
                    <button
                      disabled={!bookable}
                      onClick={() => bookable && router.push(`/gigs/${g.id}/checkout`)}
                      className="btn"
                      style={bookable ? { background: "#1E5631", border: "none", color: "#fff" } : {}}
                    >
                      Book ${(g.price / 100).toFixed(0)}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
