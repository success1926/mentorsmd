"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY_REVIEW: "Essay review",
  MOCK_INTERVIEW: "Mock interview",
  APPLICATION_STRATEGY: "Application strategy",
  TUTORING: "Tutoring",
  OTHER: "Other",
};

export function ProfileClient({ seller, reviews }: { seller: any; reviews: any[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const isBuyer = (session?.user as any)?.role === "BUYER";

  const [bookable, setBookable] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isBuyer) return;
    fetch(`/api/conversations/eligibility?sellerId=${seller.id}`)
      .then((res) => res.json())
      .then((data) => setBookable(!!data.canPickDueDate));
  }, [isBuyer, seller.id]);

  async function startConversation() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sellerId: seller.id }),
    });
    const data = await res.json();
    setConversationId(data.conversation.id);
    const msgRes = await fetch(`/api/conversations/${data.conversation.id}/messages`);
    const msgData = await msgRes.json();
    setMessages(msgData.messages || []);
  }

  async function send() {
    if ((!draft.trim() && !pendingFile) || !conversationId) return;

    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;
    if (pendingFile) {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (uploadRes.ok) {
        attachmentUrl = uploadData.url;
        attachmentName = uploadData.name;
      }
    }

    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, attachmentUrl, attachmentName }),
    });
    setDraft("");
    setPendingFile(null);

    // Re-check eligibility in case that message (or a reply already
    // present) is what unlocks booking - the coach's reply will show up
    // here once they answer, via the same polling.
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
    const elig = await fetch(`/api/conversations/eligibility?sellerId=${seller.id}`).then((r) => r.json());
    setBookable(!!elig.canPickDueDate);
  }

  async function startVideoCall() {
    if (!conversationId) return;
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

  const initials = seller.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return (
    <div>
      <Link href="/coaches" className="text-secondary" style={{ display: "inline-block", marginBottom: 16 }}>&larr; Back to browse</Link>
      <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 8 }}>
        <div className="avatar" style={{ width: 72, height: 72, fontSize: 24, background: "#1E5631" }}>{initials}</div>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>{seller.name}</h1>
          <div className="text-secondary">{seller.credential}</div>
          {avgRating && (
            <div className="text-secondary" style={{ marginTop: 4 }}>
              ★ {avgRating.toFixed(1)} · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
      <p style={{ lineHeight: 1.6, marginTop: 16, marginBottom: 24, maxWidth: 560 }}>{seller.bio}</p>

      {isBuyer && !conversationId && (
        <button onClick={startConversation} className="btn" style={{ marginBottom: 20 }}>
          Message {seller.name.split(" ")[0]}
        </button>
      )}

      {isBuyer && conversationId && (
        <div
          className="msg-thread"
          style={{ marginBottom: 20, borderColor: dragOver ? "#1E5631" : undefined, borderStyle: dragOver ? "dashed" : undefined, borderWidth: dragOver ? 2 : undefined }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) setPendingFile(file);
          }}
        >
          {messages.length === 0 && <p className="text-muted">Say hello — once they reply, booking unlocks below.</p>}
          {messages.map((m: any) => (
            <div key={m.id} className={`msg-bubble ${m.senderId === (session?.user as any)?.id ? "msg-buyer" : "msg-seller"}`}>
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
          {pendingFile && (
            <div className="text-muted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              📎 {pendingFile.name}
              <button onClick={() => setPendingFile(null)} className="btn" style={{ padding: "2px 8px", fontSize: 11 }}>Remove</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
            />
            <button onClick={() => fileInputRef.current?.click()} className="btn" title="Attach a file">📎</button>
            <input className="input" style={{ marginBottom: 0, flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a message..." />
            <button onClick={startVideoCall} disabled={videoLoading} className="btn" title="Start a video call">
              {videoLoading ? "..." : "🎥"}
            </button>
            <button onClick={send} className="btn">Send</button>
          </div>
          <p className="text-muted" style={{ margin: "6px 0 0" }}>Or drag a file anywhere in this box to attach it.</p>
        </div>
      )}

      {isBuyer && !bookable && (
        <div className="badge badge-warning" style={{ display: "block", marginBottom: 20, padding: "10px 14px" }}>
          Message {seller.name.split(" ")[0]} and wait for a reply to unlock booking and a due date.
        </div>
      )}

      <h2 style={{ fontSize: 16, color: "#5B6A61", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Packages</h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {seller.gigs.map((g: any) => (
          <div key={g.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{g.title}</div>
                  <span className="badge" style={{ background: "#EAF0EC", color: "#33413A" }}>{CATEGORY_LABELS[g.category] || g.category}</span>
                </div>
                <p className="text-secondary" style={{ lineHeight: 1.5, marginBottom: 8 }}>{g.description}</p>
                <div className="text-muted">{g.duration}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>${(g.price / 100).toFixed(0)}</div>
                {isBuyer ? (
                  <button
                    disabled={!bookable}
                    onClick={() => router.push(`/gigs/${g.id}/checkout`)}
                    className="btn"
                    style={bookable ? { background: "#1E5631", border: "none", color: "#fff" } : {}}
                  >
                    Book and pay ${(g.price / 100).toFixed(0)}
                  </button>
                ) : (
                  <Link href="/login" className="btn">Log in to book</Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {reviews.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, color: "#5B6A61", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Reviews</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card">
                <div style={{ marginBottom: r.comment ? 6 : 0 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                {r.comment && <p className="text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
