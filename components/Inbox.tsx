"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConversation, SendError } from "@/lib/hooks/useConversation";
import { OrderCalls } from "@/components/Calls";
import { Icon, ICONS, StaffBadge, Vetted, statusBadge, tintFor, initialsOf } from "@/components/ui";
import { ConfirmEmailNotice, IntegrityBanner, MessageText, ReportDialog, SendWarnings, setBlocked, type SendWarning } from "@/components/Safety";
import { money } from "@/lib/options";

function PersonAvatar({ person, size = 44 }: { person: any; size?: number }) {
  if (!person) return null;
  return person.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photoUrl} alt="" className="avatar" style={{ width: size, height: size, objectFit: "cover" }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: tintFor(person.id || person.name) }}>
      {initialsOf(person.name)}
    </span>
  );
}

function when(d: string) {
  const date = new Date(d);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// /messages and /messages/[id]: conversation list, the open thread, and a
// side panel with the orders between the two people (and "Book a call").
export function Inbox({ selectedId }: { selectedId?: string }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [conversations, setConversations] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations || []))
      .catch(() => setConversations([]));
  }, [selectedId]);

  return (
    <div className="page" style={{ paddingTop: 32 }}>
      <h1 className="page-title" style={{ fontSize: 40, marginBottom: 20 }}>Messages</h1>
      <div className={`inbox ${selectedId ? "" : "inbox-2"}`}>
        <div className={`inbox-list ${selectedId ? "has-thread" : ""}`}>
          {conversations === null && <p className="text-muted" style={{ padding: 20 }}>Loading…</p>}
          {conversations?.length === 0 && (
            <div style={{ padding: 24 }} className="stack-sm">
              <b>No messages yet</b>
              {role === "BUYER" ? (
                <>
                  <span className="text-secondary">Message any mentor for free from their profile.</span>
                  <Link href="/mentors" className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }}>Browse mentors</Link>
                </>
              ) : (
                <span className="text-secondary">When a student messages you, it shows up here.</span>
              )}
            </div>
          )}
          {conversations?.map((c) => {
            const other = role === "SELLER" ? c.buyer : c.seller;
            const last = c.messages?.[0];
            // The open conversation is being read right now.
            const unread = c.id !== selectedId ? (role === "SELLER" ? c.sellerUnread : c.buyerUnread) || 0 : 0;
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className={`inbox-item ${unread ? "unread" : ""}`} aria-current={c.id === selectedId ? "true" : undefined}>
                <PersonAvatar person={other} />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <div className="between">
                    <b className="nowrap" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{other?.name}</b>
                    {last && <span className="text-muted nowrap">{when(last.createdAt)}</span>}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="text-muted last-line grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {last ? (last.body || "Attachment") : "No messages yet"}
                    </span>
                    {unread > 0 && <span className="unread-dot" aria-label={`${unread} unread`} />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {selectedId ? (
          <Thread key={selectedId} conversationId={selectedId} />
        ) : (
          <div className="thread" style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
            <div className="stack-sm" style={{ alignItems: "center", textAlign: "center" }}>
              <span className="icon-dot"><Icon d={ICONS.chat} /></span>
              <b>Pick a conversation</b>
              <span className="text-secondary">Your messages with {role === "SELLER" ? "students" : "mentors"} show up here.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const role = (session?.user as any)?.role;
  const isBuyer = role === "BUYER";

  const [ctx, setCtx] = useState<any>(null);
  const [error, setError] = useState("");
  const [gigs, setGigs] = useState<any[]>([]);
  const [bookable, setBookable] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [showSide, setShowSide] = useState(false);
  // Safety: warnings to confirm, "confirm your email", report / block.
  const [warnings, setWarnings] = useState<SendWarning[] | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [sendError, setSendError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [report, setReport] = useState<{ messageId?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage } = useConversation(conversationId);

  const loadCtx = useCallback(() => {
    fetch(`/api/conversations/${conversationId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Conversation not found");
        else setCtx(d);
      })
      .catch(() => setError("Couldn't load this conversation"));
  }, [conversationId]);

  useEffect(loadCtx, [loadCtx]);

  const sellerId = ctx?.conversation?.sellerId;
  const refreshEligibility = useCallback(() => {
    if (!isBuyer || !sellerId) return;
    fetch(`/api/conversations/eligibility?sellerId=${sellerId}`)
      .then((r) => r.json())
      .then((d) => setBookable(!!d.canPickDueDate))
      .catch(() => {});
  }, [isBuyer, sellerId]);

  useEffect(() => {
    if (!isBuyer || !sellerId) return;
    fetch(`/api/gigs?sellerId=${encodeURIComponent(sellerId)}`)
      .then((r) => r.json())
      .then((d) => setGigs(d.gigs || []))
      .catch(() => {});
    refreshEligibility();
  }, [isBuyer, sellerId, refreshEligibility]);

  // A reply from the mentor can unlock booking.
  useEffect(() => {
    if (messages.length) refreshEligibility();
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages.length, refreshEligibility]);

  async function handleSend(acknowledgeWarnings = false) {
    if ((!draft.trim() && !pendingFile) || sending) return;
    setSending(true);
    setSendError("");
    try {
      await sendMessage(draft, pendingFile || undefined, { acknowledgeWarnings });
      setDraft("");
      setPendingFile(null);
      setWarnings(null);
    } catch (err) {
      // Keep the draft. Inline problems are shown above the box; anything
      // else the hook already showed.
      if (err instanceof SendError) {
        const code = err.data?.code;
        if (code === "WARNING") setWarnings(err.data.warnings || []);
        else if (code === "EMAIL_UNVERIFIED") setNeedsEmail(true);
        else if (code === "BLOCKED_USER") loadCtx();
        else setSendError(err.message);
      }
    }
    setSending(false);
  }

  async function toggleBlock(block: boolean) {
    setMenuOpen(false);
    if (block && !confirm(`Block ${other?.name}? Neither of you will be able to message the other. You can unblock any time.`)) return;
    try {
      await setBlocked(other.id, block);
      loadCtx();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const other = ctx ? (role === "SELLER" ? ctx.conversation.buyer : ctx.conversation.seller) : null;

  if (error) return <div className="thread" style={{ padding: 24 }}><div className="alert alert-danger">{error}</div></div>;
  if (!ctx) return <div className="thread" style={{ padding: 24 }}><span className="text-muted">Loading…</span></div>;

  const convo = ctx.conversation;
  const safety = ctx.safety || {};
  const orders: any[] = (ctx.orders || []).map((o: any) => ({ ...o, seller: convo.seller }));
  const activeOrders = orders.filter((o) => ["IN_ESCROW", "COMPLETED"].includes(o.status));
  const pastOrders = orders.filter((o) => !["IN_ESCROW", "COMPLETED"].includes(o.status));

  return (
    <>
      <div className="thread">
        <div className="thread-head">
          <button className="btn btn-ghost btn-sm hide-desktop-back" onClick={() => router.push("/messages")} aria-label="Back to all messages">←</button>
          <PersonAvatar person={other} size={40} />
          <div className="grow stack-sm" style={{ gap: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <b>{other?.name}</b>
              {role !== "SELLER" && <Vetted />}
            </div>
            {role !== "SELLER" && convo.seller.credential && <span className="text-muted">{convo.seller.credential}</span>}
          </div>
          <button className="btn btn-sm" onClick={() => setShowSide((s) => !s)} aria-expanded={showSide}>
            Orders{activeOrders.length ? ` (${activeOrders.length})` : ""}
          </button>
          <div className="menu-wrap">
            <button className="btn btn-sm btn-ghost" aria-label="Report or block" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>⋯</button>
            {menuOpen && (
              <div className="menu-pop" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button role="menuitem" onClick={() => { setMenuOpen(false); setReport({}); }}>Report {other?.name.split(" ")[0]}</button>
                {safety.iBlocked ? (
                  <button role="menuitem" onClick={() => toggleBlock(false)}>Unblock</button>
                ) : (
                  <button role="menuitem" onClick={() => toggleBlock(true)}>Block</button>
                )}
              </div>
            )}
          </div>
        </div>
        <IntegrityBanner />

        <div
          className="thread-body"
          ref={bodyRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) setPendingFile(file);
          }}
        >
          {messages.length === 0 && (
            <p className="text-muted" style={{ textAlign: "center", margin: "auto" }}>
              {isBuyer ? "Say hello. Booking unlocks once your mentor replies." : "No messages yet."}
            </p>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className={`msg-bubble ${m.senderId === userId ? "msg-mine" : "msg-theirs"}`}>
              {m.sender?.role === "ADMIN" && (
                <div style={{ marginBottom: 4 }}><StaffBadge /></div>
              )}
              <MessageText text={m.body} />
              {m.attachmentUrl && (
                <div style={{ marginTop: m.body ? 6 : 0 }}>
                  <a href={`${m.attachmentUrl}?download=1`} download={m.attachmentName} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontSize: 13 }}>
                    📎 {m.attachmentName || "Attachment"}
                  </a>
                </div>
              )}
              {m.senderId !== userId && m.sender?.role !== "ADMIN" && (
                <div className="msg-actions">
                  <button type="button" className="msg-report" onClick={() => setReport({ messageId: m.id })}>Report</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {pendingFile && (
          <div className="between text-muted" style={{ padding: "8px 16px", borderTop: "1px solid var(--line)" }}>
            📎 {pendingFile.name}
            <button onClick={() => setPendingFile(null)} className="btn btn-sm">Remove</button>
          </div>
        )}
        {warnings && (
          <SendWarnings warnings={warnings} busy={sending} onEdit={() => setWarnings(null)} onSendAnyway={() => handleSend(true)} />
        )}
        {(needsEmail || safety.emailConfirmed === false) && isBuyer && <ConfirmEmailNotice />}
        {sendError && <div role="alert" className="alert alert-danger send-warning">{sendError}</div>}
        {safety.iBlocked ? (
          <div className="thread-compose between" style={{ flexWrap: "wrap" }}>
            <span className="text-secondary">You blocked {other?.name}. Neither of you can send messages.</span>
            <button className="btn btn-sm" onClick={() => toggleBlock(false)}>Unblock</button>
          </div>
        ) : safety.theyBlocked ? (
          <div className="thread-compose"><span className="text-secondary">You can&apos;t send messages in this conversation.</span></div>
        ) : safety.onHold ? (
          <div className="thread-compose"><span className="text-secondary">Your account is paused while our team reviews it, so you can&apos;t send messages right now.</span></div>
        ) : (
        <div className="thread-compose">
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => setPendingFile(e.target.files?.[0] || null)} />
          <button onClick={() => fileInputRef.current?.click()} className="btn btn-ghost" title="Attach a file" aria-label="Attach a file">📎</button>
          <textarea
            className="input"
            rows={1}
            style={{ marginBottom: 0, flex: 1, minHeight: 46, maxHeight: 160, resize: "none" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <button onClick={() => handleSend()} disabled={sending} className="btn btn-primary">Send</button>
        </div>
        )}
      </div>
      {report && other && (
        <ReportDialog
          open
          onClose={() => setReport(null)}
          subject={{ id: other.id, name: other.name }}
          conversationId={conversationId}
          messageId={report.messageId}
          onDone={(blocked) => blocked && loadCtx()}
        />
      )}

      <aside className={`thread-side ${showSide ? "show" : ""}`}>
        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <PersonAvatar person={other} size={64} />
          <b>{other?.name}</b>
          {role !== "SELLER" && (
            <Link href={`/mentors/${convo.seller.id}`} className="link small">View profile</Link>
          )}
        </div>

        {activeOrders.length > 0 && <b>Active orders</b>}
        {activeOrders.map((o) => (
          <div key={o.id} className="card stack-sm" style={{ padding: 16 }}>
            <div className="between" style={{ alignItems: "flex-start" }}>
              <b style={{ fontSize: 15 }}>{o.gig.title}</b>
            </div>
            <div className="row-wrap">{statusBadge(o)}</div>
            {o.dueDate && <span className="text-muted">Due {new Date(o.dueDate).toLocaleDateString()}</span>}
            <OrderCalls order={o} viewer={ctx.viewer} isBuyer={isBuyer} isSeller={role === "SELLER"} onChanged={loadCtx} compact />
            <Link href={`/orders/${o.id}`} className="btn btn-sm">Open order</Link>
          </div>
        ))}

        {isBuyer && gigs.length > 0 && (
          <>
            <b style={{ marginTop: 6 }}>{convo.seller.name.split(" ")[0]}&apos;s packages</b>
            {!bookable && <span className="text-muted">Booking unlocks once {convo.seller.name.split(" ")[0]} replies.</span>}
            {gigs.map((g) => (
              <div key={g.id} className="card stack-sm" style={{ padding: 16 }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <b style={{ fontSize: 15 }}>{g.title}</b>
                  <b>{money(g.price)}</b>
                </div>
                {g.callsIncluded > 0 && <span className="text-muted">Includes {g.callsIncluded} × {g.callLength} min call</span>}
                <button disabled={!bookable} onClick={() => router.push(`/gigs/${g.id}/checkout`)} className="btn btn-primary btn-sm">
                  Book
                </button>
              </div>
            ))}
          </>
        )}

        {pastOrders.length > 0 && (
          <details className="collapse">
            <summary style={{ padding: "12px 16px", fontSize: 15 }}>Past orders ({pastOrders.length})</summary>
            <div className="collapse-body" style={{ padding: "0 16px 14px" }}>
              {pastOrders.map((o) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="between small">
                  <span>{o.gig.title}</span>
                  {statusBadge(o)}
                </Link>
              ))}
            </div>
          </details>
        )}
      </aside>
    </>
  );
}
