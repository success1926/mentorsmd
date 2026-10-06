"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useConversation } from "@/lib/hooks/useConversation";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { OrderCalls } from "@/components/Calls";
import { Icon, ICONS, statusBadge, tintFor, initialsOf } from "@/components/ui";
import { callSummary, CALL_HOLD_HOURS } from "@/lib/calls";
import { FORMATS, TURNAROUNDS, labelFor, money, serviceLabel } from "@/lib/options";

const AUTO_RELEASE_HOURS = 96;
const fmt = (d: string | Date) => new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Paid -> Held -> Delivered -> Released
function Tracker({ order }: { order: any }) {
  if (order.status === "REFUNDED") {
    return <div className="alert alert-warning">This order was refunded to the student.</div>;
  }
  if (order.status === "CANCELLED" || order.status === "PENDING_PAYMENT") return null;
  const reached =
    order.status === "RELEASED" ? 4 : order.status === "COMPLETED" ? 3 : order.status === "IN_ESCROW" ? 2 : 0;
  const steps = [
    { label: "Paid", note: fmtDay(order.createdAt) },
    { label: "Held by MentorsMD", note: reached === 2 ? "Work in progress" : "" },
    { label: "Delivered", note: order.workCompletedAt ? fmtDay(order.workCompletedAt) : "" },
    { label: "Released", note: order.completedAt && order.status === "RELEASED" ? fmtDay(order.completedAt) : "" },
  ];
  return (
    <div className="tracker" aria-label="Payment progress">
      {steps.map((s, i) => {
        const n = i + 1;
        const cls = n < reached || (n === reached && reached === 4) ? "done" : n === reached ? "done current" : "";
        return (
          <div key={s.label} className={`tracker-step ${cls}`}>
            <div className="tracker-bar" />
            <span>{s.label}</span>
            {s.note && <span className="text-muted" style={{ fontWeight: 400 }}>{s.note}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [justPaid, setJustPaid] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [showDueDate, setShowDueDate] = useState(false);
  const [dueDateValue, setDueDateValue] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [disputeDraft, setDisputeDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrder = useCallback(() => {
    fetch(`/api/orders/${orderId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setLoadError(data.error || "Order not found");
        else {
          setOrder(data.order);
          setViewer(data.viewer);
        }
      })
      .catch(() => setLoadError("Couldn't load this order"));
  }, [orderId]);

  useEffect(() => {
    loadOrder();
    setJustPaid(new URLSearchParams(window.location.search).get("success") === "true");
  }, [loadOrder]);

  const { messages, sendMessage } = useConversation(order?.conversationId || "");
  const { messages: disputeMessages, sendMessage: sendDisputeMessage } = useDisputeThread(order?.disputed ? orderId : "");

  // Generic POST helper for the order actions.
  async function act(key: string, path: string, body?: any, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return false;
    setBusy(key);
    setActionError("");
    const res = await fetch(`/api/orders/${orderId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setActionError(data.error || "Something went wrong.");
      return false;
    }
    loadOrder();
    return true;
  }

  async function handleSend() {
    if (!draft.trim() && !pendingFile) return;
    try {
      await sendMessage(draft, pendingFile || undefined);
      setDraft("");
      setPendingFile(null);
    } catch {}
  }

  if (loadError) return <div className="page-narrow"><div className="alert alert-danger">{loadError}</div></div>;
  if (!order || !viewer) return <div className="page-narrow text-muted">Loading…</div>;

  const isBuyer = viewer.id === order.buyerId;
  const isSeller = viewer.id === order.sellerId;
  const isAdmin = viewer.role === "ADMIN";
  const active = ["IN_ESCROW", "COMPLETED"].includes(order.status);
  const calls = callSummary(order);
  const other = isSeller ? order.buyer : order.seller;
  const autoReleaseAt = order.workCompletedAt ? new Date(new Date(order.workCompletedAt).getTime() + AUTO_RELEASE_HOURS * 3600_000) : null;
  const holdEndsAt = order.callHoldAt ? new Date(new Date(order.callHoldAt).getTime() + CALL_HOLD_HOURS * 3600_000) : null;

  return (
    <div className="page">
      <Link href={isSeller ? "/dashboard" : isAdmin ? "/admin" : "/orders"} className="link small" style={{ display: "inline-block", marginBottom: 20 }}>
        ← {isSeller ? "Dashboard" : isAdmin ? "Admin" : "My orders"}
      </Link>

      <div className="between" style={{ alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap" }}>
        <div className="stack-sm">
          <h1 className="page-title" style={{ fontSize: "clamp(30px, 3.4vw, 42px)" }}>{order.gig.title}</h1>
          <div className="row-wrap">
            {statusBadge(order)}
            {order.revisionRequested && active && <span className="badge badge-warning">Revision requested</span>}
          </div>
        </div>
        {order.conversationId && (
          <Link href={`/messages/${order.conversationId}`} className="btn">
            <Icon d={ICONS.chat} size={18} /> Message {other?.name?.split(" ")[0]}
          </Link>
        )}
      </div>

      <div className="order-grid">
        <div className="stack-lg" style={{ gap: 20 }}>
          <div className="card"><Tracker order={order} /></div>

          {justPaid && order.status === "IN_ESCROW" && (
            <div className="alert alert-success">
              Payment received. MentorsMD is holding it until you approve the work.
              {calls.canBook ? " Next: book your call below." : ""}
            </div>
          )}
          {justPaid && order.status === "PENDING_PAYMENT" && (
            <div className="alert">Confirming your payment with Stripe… refresh in a few seconds.</div>
          )}

          {order.revisionRequested && order.revisionNote && active && (
            <div className="card stack-sm" style={{ borderColor: "#F5DDA8" }}>
              <b>Revision requested</b>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{order.revisionNote}</p>
              {order.dueDate && <span className="text-muted">New due date: {fmtDay(order.dueDate)}</span>}
            </div>
          )}

          {/* Unbooked call: order on hold */}
          {calls.onHold && !order.disputed && (
            <div className="card stack" style={{ borderColor: "#F5DDA8", background: "#FFFBF2" }}>
              <b className="row"><Icon d={ICONS.pause} size={18} /> On hold: the included call isn&apos;t booked</b>
              {isBuyer ? (
                <>
                  <span className="text-secondary">
                    The due date passed before the call was booked. Book it now, or tell us you don&apos;t need it.
                    {holdEndsAt && ` If nothing happens by ${fmt(holdEndsAt)}, the call may be forfeited and your mentor can complete the order.`}
                  </span>
                  <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy === "skip"}
                    onClick={() => act("skip", "skip-call", undefined, "Skip the call? Your mentor can then complete the order without it.")}>
                    I don&apos;t need the call
                  </button>
                </>
              ) : (
                <>
                  <span className="text-secondary">
                    The student has until {holdEndsAt ? fmt(holdEndsAt) : "soon"} to book or skip. You can give them more time, message them, or ask us to step in.
                  </span>
                  {isSeller && (
                    <div className="row-wrap">
                      <button className="btn btn-sm" onClick={() => setShowDueDate(true)}>Extend due date</button>
                      {order.conversationId && <Link href={`/messages/${order.conversationId}`} className="btn btn-sm">Message student</Link>}
                      <Link href="/contact" className="btn btn-sm">Ask admin</Link>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Calls */}
          {calls.included > 0 && order.status !== "PENDING_PAYMENT" && (
            <div className="card">
              <OrderCalls order={order} viewer={viewer} isBuyer={isBuyer} isSeller={isSeller} onChanged={loadOrder} />
              {isBuyer && calls.canBook && !calls.onHold && !order.disputed && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, color: "var(--muted)" }} disabled={busy === "skip"}
                  onClick={() => act("skip", "skip-call", undefined, "Skip the call? Your mentor can then complete the order without it.")}>
                  I don&apos;t need the call
                </button>
              )}
            </div>
          )}

          {/* Dispute thread */}
          {order.disputed && (
            <div className="card stack" style={{ borderColor: "#F3D0D0" }}>
              <b>Dispute: conversation with the MentorsMD team</b>
              <span className="text-secondary">
                {active
                  ? "Payment stays on hold until an admin reviews this and decides. Reply here if they ask for more details."
                  : `Resolved: ${order.status === "REFUNDED" ? "refunded to the student" : "released to the mentor"}.`}
              </span>
              <div className="msg-thread">
                {disputeMessages.length === 0 && <p className="text-muted">Loading…</p>}
                {disputeMessages.map((m: any) => (
                  <div key={m.id} className={`msg-bubble ${m.sender?.role === "ADMIN" ? "msg-theirs" : "msg-mine"}`}>
                    <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{m.sender?.name}{m.sender?.role === "ADMIN" ? " (Admin)" : ""}</div>
                    {m.body}
                  </div>
                ))}
              </div>
              {active && (
                <div className="row">
                  <input className="input grow" style={{ marginBottom: 0 }} placeholder="Reply…" value={disputeDraft}
                    onChange={(e) => setDisputeDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && disputeDraft.trim()) { sendDisputeMessage(disputeDraft); setDisputeDraft(""); } }} />
                  <button className="btn" onClick={() => { if (disputeDraft.trim()) { sendDisputeMessage(disputeDraft); setDisputeDraft(""); } }}>Send</button>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {order.conversationId && (isBuyer || isSeller) && (
            <div className="card stack" style={{ gap: 12 }}>
              <div className="between">
                <b>Messages with {other?.name}</b>
                <Link href={`/messages/${order.conversationId}`} className="link small">Open in Messages</Link>
              </div>
              <div className="msg-thread" style={{ maxHeight: 380, overflowY: "auto", border: "none", padding: 0 }}>
                {messages.length === 0 && <p className="text-muted">No messages yet.</p>}
                {messages.slice(-30).map((m: any) => (
                  <div key={m.id} className={`msg-bubble ${m.senderId === viewer.id ? "msg-mine" : "msg-theirs"}`}>
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
              </div>
              {pendingFile && (
                <div className="between text-muted">📎 {pendingFile.name}<button onClick={() => setPendingFile(null)} className="btn btn-sm">Remove</button></div>
              )}
              <div className="row">
                <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
                <button onClick={() => fileInputRef.current?.click()} className="btn btn-ghost" aria-label="Attach a file">📎</button>
                <input className="input grow" style={{ marginBottom: 0 }} value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Write a message…" aria-label="Message" />
                <button onClick={handleSend} className="btn btn-primary">Send</button>
              </div>
            </div>
          )}

          {/* Review */}
          {order.status === "RELEASED" && isBuyer && (
            order.review ? (
              <div className="card stack-sm">
                <b>Your review</b>
                <span className="stars">{"★".repeat(order.review.rating)}{"☆".repeat(5 - order.review.rating)}</span>
                {order.review.comment && <p className="text-secondary">{order.review.comment}</p>}
              </div>
            ) : (
              <div className="card stack">
                <b>Leave a review for {order.seller?.name?.split(" ")[0]}</b>
                <div className="row" style={{ gap: 4, fontSize: 28 }} role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} role="radio" aria-checked={reviewRating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setReviewRating(n)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 28, color: n <= reviewRating ? "var(--primary)" : "var(--line)", padding: 0 }}>
                      ★
                    </button>
                  ))}
                </div>
                <textarea className="input" style={{ marginBottom: 0 }} placeholder="What was it like working together? (optional)" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!reviewRating || busy === "review"}
                  onClick={() => act("review", "review", { rating: reviewRating, comment: reviewComment || undefined })}>
                  Submit review
                </button>
              </div>
            )
          )}
        </div>

        {/* ---------- Side ---------- */}
        <aside className="sticky-side">
          <div className="card stack" style={{ gap: 14 }}>
            <div className="row">
              {other?.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.photoUrl} alt="" className="avatar" style={{ objectFit: "cover" }} />
              ) : (
                <span className="avatar" style={{ background: tintFor(other?.name || "") }}>{initialsOf(other?.name || "")}</span>
              )}
              <div className="stack-sm" style={{ gap: 0 }}>
                <span className="text-muted">{isSeller ? "Student" : "Mentor"}</span>
                <b>{other?.name}</b>
              </div>
            </div>
            <hr className="divider" />
            <div className="stack-sm small">
              <div className="between"><span className="text-secondary">Amount</span><b>{money(order.amount)}</b></div>
              {order.gig.service && <div className="between"><span className="text-secondary">Service</span><span>{serviceLabel(order.gig.service, order.gig.serviceOther)}</span></div>}
              {order.gig.format && <div className="between"><span className="text-secondary">Format</span><span>{labelFor(FORMATS, order.gig.format)}</span></div>}
              {order.gig.turnaround && <div className="between"><span className="text-secondary">Turnaround</span><span>{labelFor(TURNAROUNDS, order.gig.turnaround)}</span></div>}
              {order.dueDate && <div className="between"><span className="text-secondary">Due</span><b>{fmtDay(order.dueDate)}</b></div>}
            </div>
            {isSeller && active && (
              showDueDate ? (
                <div className="stack-sm">
                  <span className="text-muted">A revision request sets the due date to 7 days out. Use this if you need longer, or to give the student more time to book a call.</span>
                  <input type="date" className="input" style={{ marginBottom: 0 }} value={dueDateValue} onChange={(e) => setDueDateValue(e.target.value)} />
                  <div className="row">
                    <button className="btn btn-soft btn-sm" disabled={!dueDateValue || busy === "due"}
                      onClick={async () => { if (await act("due", "due-date", { dueDate: dueDateValue })) setShowDueDate(false); }}>
                      Save due date
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDueDate(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-sm" onClick={() => setShowDueDate(true)}>Change due date</button>
              )
            )}
          </div>

          {actionError && <div role="alert" className="alert alert-danger">{actionError}</div>}

          {/* Mentor actions */}
          {isSeller && order.status === "IN_ESCROW" && !order.disputed && (
            <div className="card stack-sm">
              <button className="btn btn-deep btn-block" disabled={busy === "complete" || !calls.satisfied}
                onClick={() => act("complete", "mark-complete", undefined, "Mark this work as complete? The student gets 96 hours to review it.")}>
                Mark work as complete
              </button>
              <span className="text-muted">
                {calls.satisfied
                  ? `The student then has ${AUTO_RELEASE_HOURS} hours to review. Payment releases to you automatically after that.`
                  : "Available once the included call has happened (or the student skips it)."}
              </span>
            </div>
          )}
          {isSeller && order.status === "COMPLETED" && !order.disputed && (
            <div className="alert">
              Delivered. The student is reviewing it{autoReleaseAt ? `; payment releases automatically by ${fmt(autoReleaseAt)}` : ""}.
            </div>
          )}

          {/* Student actions */}
          {isBuyer && order.status === "COMPLETED" && !order.disputed && (
            <div className="card stack-sm">
              <button className="btn btn-primary btn-block" disabled={busy === "release"}
                onClick={() => act("release", "release", undefined, `Release ${money(order.amount)} to ${order.seller?.name}? This can't be undone.`)}>
                Approve and release payment
              </button>
              <span className="text-muted">
                No rush. If you do nothing, it releases automatically{autoReleaseAt ? ` on ${fmt(autoReleaseAt)}` : ""}.
              </span>
            </div>
          )}

          {isBuyer && active && !order.disputed && (
            <div className="card stack-sm">
              {!showRevision ? (
                <button className="btn btn-block" onClick={() => setShowRevision(true)}>Request a revision</button>
              ) : (
                <>
                  <textarea className="input" style={{ marginBottom: 0 }} placeholder="What needs to change?" value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} />
                  <span className="text-muted">This gives your mentor 7 more days and pauses auto-release.</span>
                  <div className="row">
                    <button className="btn btn-soft btn-sm" disabled={!revisionNote.trim() || busy === "revision"}
                      onClick={async () => { if (await act("revision", "request-revision", { note: revisionNote })) { setShowRevision(false); setRevisionNote(""); } }}>
                      Send request
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowRevision(false)}>Cancel</button>
                  </div>
                </>
              )}
              {!showDispute ? (
                <button className="btn btn-ghost btn-block" style={{ color: "var(--muted)" }} onClick={() => setShowDispute(true)}>Report a problem</button>
              ) : (
                <>
                  <textarea className="input" style={{ marginBottom: 0 }} placeholder="Describe the issue. An admin will review it and payment stays on hold." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
                  <div className="row">
                    <button className="btn btn-danger btn-sm" disabled={!disputeReason.trim() || busy === "dispute"}
                      onClick={async () => { if (await act("dispute", "dispute", { reason: disputeReason })) { setShowDispute(false); setDisputeReason(""); } }}>
                      Open a dispute
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDispute(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Admin resolution */}
          {isAdmin && active && (
            <div className="card stack-sm">
              <b>Admin</b>
              <button className="btn btn-danger btn-block" disabled={!!busy}
                onClick={() => act("refund", "refund", undefined, "Refund the student in full?")}>Refund student</button>
              <button className="btn btn-block" disabled={!!busy}
                onClick={() => act("release", "release", undefined, "Release payment to the mentor?")}>Release to mentor</button>
            </div>
          )}

          {order.status === "RELEASED" && <div className="alert alert-success">Payment released to {order.seller?.name}.</div>}
        </aside>
      </div>
    </div>
  );
}
