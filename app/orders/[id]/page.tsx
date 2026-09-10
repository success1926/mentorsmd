"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConversation } from "@/lib/hooks/useConversation";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";

const AUTO_RELEASE_HOURS = 96;

export default function OrderDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [marking, setMarking] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const [showDueDate, setShowDueDate] = useState(false);
  const [dueDateValue, setDueDateValue] = useState("");
  const [savingDueDate, setSavingDueDate] = useState(false);

  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputing, setDisputing] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  function loadOrder() {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => setOrder(data.orders?.find((o: any) => o.id === orderId)));
  }

  useEffect(loadOrder, [orderId]);

  const { messages, sendMessage } = useConversation(order?.conversationId || "");
  const { messages: disputeMessages, sendMessage: sendDisputeMessage } = useDisputeThread(order?.disputed ? orderId : "");
  const [disputeDraft, setDisputeDraft] = useState("");

  async function handleSendDisputeMessage() {
    if (!disputeDraft.trim()) return;
    await sendDisputeMessage(disputeDraft);
    setDisputeDraft("");
  }

  async function handleSend() {
    if (!draft.trim() && !pendingFile) return;
    await sendMessage(draft, pendingFile || undefined);
    setDraft("");
    setPendingFile(null);
  }

  async function handleMarkComplete() {
    setMarking(true);
    const res = await fetch(`/api/orders/${orderId}/mark-complete`, { method: "POST" });
    if (res.ok) loadOrder();
    setMarking(false);
  }

  async function handleRelease() {
    setReleasing(true);
    setReleaseError("");
    const res = await fetch(`/api/orders/${orderId}/release`, { method: "POST" });
    if (res.ok) {
      setOrder((prev: any) => ({ ...prev, status: "RELEASED" }));
    } else {
      const data = await res.json();
      setReleaseError(data.error || "Something went wrong.");
    }
    setReleasing(false);
  }

  async function handleVideoCall() {
    setVideoLoading(true);
    const res = await fetch("/api/video/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: order.conversationId }),
    });
    const data = await res.json();
    setVideoLoading(false);
    if (data.url) window.open(data.url, "_blank");
  }

  async function handleSchedule() {
    if (!scheduleValue) return;
    setScheduling(true);
    const res = await fetch(`/api/orders/${orderId}/schedule-call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledCallTime: scheduleValue }),
    });
    if (res.ok) { setShowSchedule(false); loadOrder(); }
    setScheduling(false);
  }

  async function handleChangeDueDate() {
    if (!dueDateValue) return;
    setSavingDueDate(true);
    const res = await fetch(`/api/orders/${orderId}/due-date`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: dueDateValue }),
    });
    if (res.ok) { setShowDueDate(false); loadOrder(); }
    setSavingDueDate(false);
  }

  async function handleRequestRevision() {
    if (!revisionNote.trim()) return;
    setRequestingRevision(true);
    const res = await fetch(`/api/orders/${orderId}/request-revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: revisionNote }),
    });
    if (res.ok) { setShowRevision(false); setRevisionNote(""); loadOrder(); }
    setRequestingRevision(false);
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return;
    setDisputing(true);
    const res = await fetch(`/api/orders/${orderId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: disputeReason }),
    });
    if (res.ok) { setShowDispute(false); setDisputeReason(""); loadOrder(); }
    setDisputing(false);
  }

  async function handleSubmitReview() {
    if (!reviewRating) return;
    setSubmittingReview(true);
    const res = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }),
    });
    if (res.ok) loadOrder();
    setSubmittingReview(false);
  }

  if (!order) return <p className="text-muted">Loading...</p>;

  const userId = (session?.user as any)?.id;
  const isBuyer = order.buyer && userId === order.buyerId;
  const isSeller = order.seller && userId === order.sellerId;
  const canDiscuss = ["IN_ESCROW", "COMPLETED"].includes(order.status); // messaging/video/revisions/disputes all live here

  const dueLabel = order.dueDate
    ? new Date(order.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const scheduledLabel = order.scheduledCallTime
    ? new Date(order.scheduledCallTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const autoReleaseAt = order.workCompletedAt
    ? new Date(new Date(order.workCompletedAt).getTime() + AUTO_RELEASE_HOURS * 60 * 60 * 1000)
    : null;

  const statusLabel =
    order.status === "RELEASED" ? "Released" :
    order.status === "REFUNDED" ? "Refunded" :
    order.status === "COMPLETED" ? "Awaiting your review" :
    "Pending";

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{order.gig?.title}</div>
            <div className="text-secondary" style={{ marginTop: 2 }}>
              {order.seller?.name} · ${(order.amount / 100).toFixed(2)} paid
            </div>
            {dueLabel && <div className="text-muted" style={{ marginTop: 6 }}>Due {dueLabel}</div>}
            {isSeller && ["IN_ESCROW", "COMPLETED"].includes(order.status) && (
              <button
                onClick={() => setShowDueDate(!showDueDate)}
                className="btn"
                style={{ padding: "2px 8px", fontSize: 11, marginTop: 6 }}
              >
                Change due date
              </button>
            )}
            {scheduledLabel && <div className="text-muted" style={{ marginTop: 2 }}>📅 Call scheduled for {scheduledLabel}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span className={`badge ${order.status === "RELEASED" ? "badge-success" : "badge-warning"}`}>{statusLabel}</span>
            {order.revisionRequested && <span className="badge badge-warning">Revision requested</span>}
            {order.disputed && <span className="badge" style={{ background: "#F3D0D0", color: "#DC2626" }}>Disputed</span>}
          </div>
        </div>

        {order.conversationId && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button onClick={() => setShowSchedule(!showSchedule)} className="btn" style={{ flex: 1 }}>
              Schedule a call
            </button>
          </div>
        )}

        {showSchedule && (
          <div style={{ marginTop: 12, borderTop: "1px solid #D8E2DC", paddingTop: 12 }}>
            <input type="datetime-local" className="input" value={scheduleValue} onChange={(e) => setScheduleValue(e.target.value)} />
            <button onClick={handleSchedule} disabled={scheduling || !scheduleValue} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
              {scheduling ? "Saving..." : "Confirm time"}
            </button>
          </div>
        )}

        {showDueDate && (
          <div style={{ marginTop: 12, borderTop: "1px solid #D8E2DC", paddingTop: 12 }}>
            <p className="text-muted" style={{ marginTop: 0, marginBottom: 8 }}>
              A revision request automatically sets the due date to 7 days out - use this if you need more time than that.
            </p>
            <input type="date" className="input" value={dueDateValue} onChange={(e) => setDueDateValue(e.target.value)} />
            <button onClick={handleChangeDueDate} disabled={savingDueDate || !dueDateValue} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
              {savingDueDate ? "Saving..." : "Update due date"}
            </button>
          </div>
        )}
      </div>

      {order.disputed && (
        <div className="card" style={{ marginBottom: 14, borderColor: "#F3D0D0" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Dispute conversation with the admin team</div>
          <p className="text-secondary" style={{ marginBottom: 12 }}>
            Payment is on hold until an admin reviews this and makes a decision - reply here if they ask for more details.
          </p>
          <div className="msg-thread" style={{ marginBottom: 12 }}>
            {disputeMessages.length === 0 && <p className="text-muted">Loading...</p>}
            {disputeMessages.map((m: any) => (
              <div key={m.id} className={`msg-bubble ${m.sender?.role === "ADMIN" ? "msg-seller" : "msg-buyer"}`}>
                <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{m.sender?.name}{m.sender?.role === "ADMIN" ? " (Admin)" : ""}</div>
                {m.body}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Reply to the admin..."
              value={disputeDraft}
              onChange={(e) => setDisputeDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendDisputeMessage()}
            />
            <button onClick={handleSendDisputeMessage} className="btn">Send</button>
          </div>
        </div>
      )}

      {order.conversationId && (
        <>
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
              <input className="input" style={{ marginBottom: 0, flex: 1 }} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Write a message..." />
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
          <p className="text-muted" style={{ marginBottom: 14 }}>
            Messaging and video are always available here, no matter what stage the order is at. Drag a file anywhere in the box above to attach it.
          </p>
        </>
      )}

      {/* SELLER: mark complete, while still IN_ESCROW */}
      {isSeller && order.status === "IN_ESCROW" && (
        <button onClick={handleMarkComplete} disabled={marking} className="btn-success" style={{ marginBottom: 14 }}>
          {marking ? "Marking complete..." : "Mark work as complete"}
        </button>
      )}
      {isSeller && order.status === "IN_ESCROW" && (
        <p className="text-muted" style={{ textAlign: "center", marginBottom: 14, marginTop: -8 }}>
          Once you mark this complete, the buyer has {AUTO_RELEASE_HOURS} hours to review - payment releases to you automatically either way.
        </p>
      )}
      {isSeller && order.status === "COMPLETED" && (
        <p className="text-secondary" style={{ textAlign: "center", marginBottom: 14 }}>
          Waiting on the buyer's {AUTO_RELEASE_HOURS}-hour review window
          {autoReleaseAt && <> - payment releases automatically by {autoReleaseAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} either way</>}.
        </p>
      )}

      {/* BUYER: revision/dispute available anytime work is being discussed */}
      {isBuyer && canDiscuss && (
        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {!showRevision ? (
            <button onClick={() => setShowRevision(true)} className="btn" style={{ width: "100%" }}>Request a revision</button>
          ) : (
            <div className="card">
              <textarea className="input" placeholder="What needs to change?" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleRequestRevision} disabled={requestingRevision} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
                  {requestingRevision ? "Sending..." : "Send request"}
                </button>
                <button onClick={() => setShowRevision(false)} className="btn">Cancel</button>
              </div>
            </div>
          )}

          {!showDispute ? (
            <button onClick={() => setShowDispute(true)} className="btn" style={{ width: "100%" }}>Open a dispute</button>
          ) : (
            <div className="card">
              <textarea className="input" placeholder="Describe the issue - an admin will review this" value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleDispute} disabled={disputing} className="btn" style={{ background: "#DC2626", border: "none", color: "#fff" }}>
                  {disputing ? "Submitting..." : "Submit dispute"}
                </button>
                <button onClick={() => setShowDispute(false)} className="btn">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BUYER: confirm early once seller has marked it complete */}
      {isBuyer && order.status === "COMPLETED" && (
        <>
          <button onClick={handleRelease} disabled={releasing} className="btn-success">
            {releasing ? "Releasing..." : "Release payment now"}
          </button>
          {releaseError && (
            <p style={{ color: "#92700F", fontSize: 13, textAlign: "center", marginTop: 8 }}>{releaseError}</p>
          )}
          <p className="text-muted" style={{ textAlign: "center", marginTop: 8 }}>
            No rush - if you don't do anything, this releases automatically
            {autoReleaseAt && <> at {autoReleaseAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}.
          </p>
        </>
      )}

      {order.status === "RELEASED" && (
        <>
          <div style={{ textAlign: "center", color: "#15803D", fontSize: 14, marginBottom: 16 }}>Payment released to {order.seller?.name}.</div>
          {isBuyer && (
            order.review ? (
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ marginBottom: order.review.comment ? 6 : 0 }}>
                  {"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}
                </div>
                {order.review.comment && <p className="text-secondary" style={{ margin: 0 }}>{order.review.comment}</p>}
              </div>
            ) : (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Leave a review</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 10, fontSize: 24 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} onClick={() => setReviewRating(n)} style={{ cursor: "pointer", color: n <= reviewRating ? "#1E5631" : "#D8E2DC" }}>★</span>
                  ))}
                </div>
                <textarea className="input" placeholder="Optional comment" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                <button onClick={handleSubmitReview} disabled={submittingReview || !reviewRating} className="btn" style={{ background: "#1E5631", border: "none", color: "#fff" }}>
                  {submittingReview ? "Submitting..." : "Submit review"}
                </button>
              </div>
            )
          )}
        </>
      )}

      {order.status === "REFUNDED" && (
        <div style={{ textAlign: "center", color: "#DC2626", fontSize: 14 }}>This order was refunded.</div>
      )}
    </div>
  );
}
