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
  const [eligReason, setEligReason] = useState<string>("not_messaged");
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
      .then((data) => {
        setBookable(!!data.canPickDueDate);
        setEligReason(data.reason || "");
      });
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
      if (!uploadRes.ok) {
        alert(uploadData.error || "That file couldn't be uploaded");
        return; // keep the draft and file so they can fix it
      }
      attachmentUrl = uploadData.url;
      attachmentName = uploadData.name;
    }

    const sendRes = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, attachmentUrl, attachmentName }),
    });
    if (!sendRes.ok) {
      alert((await sendRes.json().catch(() => ({}))).error || "Message failed to send");
      return;
    }
    setDraft("");
    setPendingFile(null);

    // Re-check eligibility in case that message (or a reply already
    // present) is what unlocks booking - the coach's reply will show up
    // here once they answer, via the same polling.
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
    const elig = await fetch(`/api/conversations/eligibility?sellerId=${seller.id}`).then((r) => r.json());
    setEligReason(elig.reason || "");
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
      <Link href="/coaches" className="text-secondary" style={{ display: "inline-block", marginBottom: 16, fontWeight: 600, color: "var(--primary-deep)" }}>&larr; All coaches</Link>
      <section className="card" style={{ padding: 0, marginBottom: 24, overflow: "hidden" }}>
        <div className="profile-banner" />
        <div style={{ padding: "0 28px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="avatar" style={{ width: 104, height: 104, fontSize: 36, marginTop: -52, border: "5px solid #fff", position: "relative" }}>{initials}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 34 }}>{seller.name}</h1>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--primary)" role="img" aria-label="Verified coach">
              <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3.1 3.2.3z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            <span className="badge badge-brand">Verified by MentorsMD</span>
          </div>
          {seller.credential && <div style={{ fontSize: 17, fontWeight: 600 }}>{seller.credential}</div>}
          <div className="text-secondary" style={{ fontSize: 15 }}>
            {avgRating ? (
              <><span className="stars">★</span> <b style={{ color: "var(--ink)" }}>{avgRating.toFixed(1)}</b> ({reviews.length} review{reviews.length !== 1 ? "s" : ""})</>
            ) : (
              <span className="badge badge-brand">New coach</span>
            )}
          </div>
          {seller.bio && <p className="text-secondary" style={{ lineHeight: 1.65, margin: "6px 0 0", fontSize: 16 }}>{seller.bio}</p>}
        </div>
      </section>

      {isBuyer && !conversationId && (
        <button onClick={startConversation} className="btn btn-solid btn-lg" style={{ marginBottom: 20 }}>
          Message {seller.name.split(" ")[0]}
        </button>
      )}

      {isBuyer && conversationId && (
        <div
          className="msg-thread"
          style={{ marginBottom: 20, borderColor: dragOver ? "#5536D6" : undefined, borderStyle: dragOver ? "dashed" : undefined, borderWidth: dragOver ? 2 : undefined }}
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

      {isBuyer && (
        <div className="card" style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="eyebrow" style={{ color: "var(--muted)" }}>Before you book</div>
          {[
            { label: `Message ${seller.name.split(" ")[0]}`, done: bookable || eligReason === "awaiting_reply" },
            { label: `${seller.name.split(" ")[0]} replies`, done: bookable },
            { label: "Pick a due date & pay (held until you approve)", done: false },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  background: step.done ? "var(--primary)" : "#fff",
                  color: step.done ? "#fff" : "var(--primary)",
                  border: step.done ? "none" : "2px solid var(--tint-2)",
                }}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span style={{ fontWeight: step.done ? 600 : 500 }}>{step.label}</span>
              <span className="sr-only">{step.done ? "(done)" : "(not yet)"}</span>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 28, margin: "0 0 14px" }}>Packages</h2>
      <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
        {seller.gigs.map((g: any) => (
          <div key={g.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{g.title}</div>
                  <span className="badge badge-brand">{CATEGORY_LABELS[g.category] || g.category}</span>
                </div>
                <p className="text-secondary" style={{ lineHeight: 1.5, marginBottom: 8 }}>{g.description}</p>
                <div className="text-muted">{g.duration}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div className="display" style={{ fontSize: 28, marginBottom: 8 }}>${(g.price / 100).toFixed(0)}</div>
                {isBuyer ? (
                  <button
                    disabled={!bookable}
                    onClick={() => router.push(`/gigs/${g.id}/checkout`)}
                    className="btn"
                    style={bookable ? { background: "#5536D6", border: "none", color: "#fff" } : {}}
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
          <h2 style={{ fontSize: 28, margin: "0 0 14px" }}>Reviews</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card">
                <div style={{ marginBottom: r.comment ? 6 : 0 }}><span className="stars" aria-label={`${r.rating} out of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></div>
                {r.comment && <p className="text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
