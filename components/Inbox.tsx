"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AboutYouNudge } from "@/components/AboutYouNudge";
import { StudentCard } from "@/components/StudentCard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useConversation, SendError } from "@/lib/hooks/useConversation";
import { onLive } from "@/lib/realtimeClient";
import { Collapsible, EmptyState, Icon, ICONS, LoadingBlock, MinorBadge, PageHeader, PersonAvatar, StaffBadge, StatusBadge } from "@/components/ui";
import { PackageRow } from "@/components/PackageRow";
import { useConfirm } from "@/components/ConfirmDialog";
import { firstName, fmtDateTime, fmtDay, fmtDayShort, fmtTime } from "@/lib/format";
import { ConfirmEmailNotice, IntegrityBanner, MessageText, ReportDialog, SendWarnings, setBlocked, type SendWarning } from "@/components/Safety";
import { money } from "@/lib/format";
import { MOMENTS } from "@/lib/moments";
import { BookCallModal, SharedFiles } from "@/components/Packages";
import { hoursSummary, shortHours } from "@/lib/hours";

// The line under a name in the list (redesign Oct 2026): the package and
// its hours left, a booked intro call, or "Waiting for a reply".
function contextLine(c: any, userId: string, role: string): { text: string; muted: boolean } | null {
  const pkg = c.context?.package;
  if (pkg) return { text: `${pkg.title} · ${shortHours(pkg.minutesLeft)} left${pkg.count > 1 ? ` (+${pkg.count - 1} more)` : ""}`, muted: false };
  const intro = c.context?.introCallAt;
  if (intro) return { text: `No package yet · intro call booked ${fmtDayShort(intro)}`, muted: false };
  const last = c.messages?.[0];
  if (last && last.senderId === userId) return { text: "Waiting for a reply", muted: true };
  return null;
}

// Today: the time; before that: the date.
function when(d: string) {
  const date = new Date(d);
  return date.toDateString() === new Date().toDateString() ? fmtTime(date) : fmtDay(date);
}

// /messages and /messages/[id]: conversation list, the open thread, and a
// side panel with the orders between the two people (and "Book a call").
export function Inbox({ selectedId }: { selectedId?: string }) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  const [conversations, setConversations] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = () =>
      fetch("/api/conversations")
        .then((r) => r.json())
        .then((d) => setConversations(d.conversations || []))
        .catch(() => setConversations((prev) => prev ?? []));
    load();
    // A new message anywhere moves that conversation up and updates its
    // unread count (live updates, lib/realtimeClient.ts).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onLive((event) => {
      if (event !== "message") return;
      clearTimeout(timer);
      timer = setTimeout(load, 800);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [selectedId]);

  return (
    <div className="page">
      <PageHeader title="Messages" back={selectedId ? { href: "/messages", label: "All messages" } : undefined} />
      <div className={`inbox ${selectedId ? "" : "inbox-2"}`}>
        <div className={`inbox-list ph-no-capture ${selectedId ? "has-thread" : ""}`}>
          {(conversations?.length || 0) > 0 && (
            <div className="inbox-search">
              <input className="input" type="search" placeholder={role === "SELLER" ? "Search students" : "Search mentors"} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search conversations" />
            </div>
          )}
          {conversations === null && <div style={{ padding: 20 }}><LoadingBlock title={false} lines={4} /></div>}
          {conversations?.length === 0 && (
            <div style={{ padding: 16 }}>
              <EmptyState title="No messages yet" action={role === "BUYER" ? <Link href="/mentors" className="btn btn-primary btn-sm">Browse mentors</Link> : undefined}>
                {role === "BUYER" ? "Message any mentor for free from their profile." : "When a student messages you, it shows up here."}
              </EmptyState>
            </div>
          )}
          {conversations
            ?.filter((c) => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              const other = role === "SELLER" ? c.buyer : c.seller;
              return [other?.name, c.context?.package?.title, c.messages?.[0]?.body].some((v) => (v || "").toLowerCase().includes(q));
            })
            .map((c) => {
            const other = role === "SELLER" ? c.buyer : c.seller;
            const last = c.messages?.[0];
            const ctx = contextLine(c, userId, role);
            // The open conversation is being read right now.
            const unread = c.id !== selectedId ? (role === "SELLER" ? c.sellerUnread : c.buyerUnread) || 0 : 0;
            return (
              <Link key={c.id} href={`/messages/${c.id}`} className={`inbox-item ${unread ? "unread" : ""}`} aria-current={c.id === selectedId ? "true" : undefined}>
                <PersonAvatar person={other} size={44} fontSize={17} />
                <div className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                  <div className="between">
                    <span className="row" style={{ gap: 6, minWidth: 0 }}>
                      <b className="nowrap" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{other?.name}</b>
                      {role === "SELLER" && <MinorBadge person={other} />}
                    </span>
                    {last && <span className="text-muted nowrap">{when(last.createdAt)}</span>}
                  </div>
                  {ctx && <span className={`context-line ${ctx.muted ? "muted" : ""}`}>{ctx.text}</span>}
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
  const [bookOpen, setBookOpen] = useState(false);
  // Safety: warnings to confirm, "confirm your email", report / block.
  const [warnings, setWarnings] = useState<SendWarning[] | null>(null);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [sendError, setSendError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [report, setReport] = useState<{ messageId?: string } | null>(null);
  const { confirm, notify, dialog } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage } = useConversation(conversationId);
  // Moment 10 (lib/moments.ts): messages that arrive after the thread has loaded slide up; yours gets a "Sent" tick.
  const knownIds = useRef<Set<string>>(new Set());
  const [liveAfter, setLiveAfter] = useState(false);
  const [sentTick, setSentTick] = useState(0);
  useEffect(() => {
    knownIds.current = new Set();
    setLiveAfter(false);
    const t = setTimeout(() => setLiveAfter(true), 1500);
    return () => clearTimeout(t);
  }, [conversationId]);
  useEffect(() => {
    if (!liveAfter) messages.forEach((m: any) => knownIds.current.add(m.id));
    else {
      const t = setTimeout(() => messages.forEach((m: any) => knownIds.current.add(m.id)), 400);
      return () => clearTimeout(t);
    }
  }, [messages, liveAfter]);
  useEffect(() => {
    if (!sentTick) return;
    const t = setTimeout(() => setSentTick(0), 2600);
    return () => clearTimeout(t);
  }, [sentTick]);

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
      if (MOMENTS.messages) setSentTick(Date.now());
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
    if (block && !(await confirm({ title: `Block ${other?.name}?`, body: "Neither of you will be able to message the other. You can unblock any time.", confirmLabel: "Block", danger: true }))) return;
    try {
      await setBlocked(other.id, block);
      loadCtx();
    } catch (e: any) {
      await notify("That didn't work", e.message);
    }
  }

  const other = ctx ? (role === "SELLER" ? ctx.conversation.buyer : ctx.conversation.seller) : null;

  if (error) return <div className="thread" style={{ padding: 24 }}><div className="alert alert-danger">{error}</div></div>;
  if (!ctx) return <div className="thread" style={{ padding: 24 }}><LoadingBlock lines={4} /></div>;

  const convo = ctx.conversation;
  const safety = ctx.safety || {};
  const orders: any[] = (ctx.orders || []).map((o: any) => ({ ...o, seller: convo.seller, buyer: o.buyer || convo.buyer }));
  const activeOrders = orders.filter((o) => ["IN_ESCROW", "COMPLETED"].includes(o.status));
  const pastOrders = orders.filter((o) => !["IN_ESCROW", "COMPLETED"].includes(o.status));

  return (
    <>
      {dialog}
      <div className="thread">
        <div className="thread-head">
          <PersonAvatar person={other} size={40} fontSize={15} />
          <div className="grow stack-sm" style={{ gap: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <b>{other?.name}</b>
              {role === "SELLER" && <MinorBadge person={other} />}
            </div>
            {role !== "SELLER" && convo.seller.credential && <span className="text-muted">{convo.seller.credential}</span>}
          </div>
          {isBuyer && (
            <button className="btn btn-sm btn-primary" onClick={() => setBookOpen(true)}>Book a call</button>
          )}
          <button className="btn btn-sm toggle-btn" onClick={() => setShowSide((s) => !s)} aria-expanded={showSide} aria-controls="thread-side">
            Package · files{activeOrders.length ? <span className="tab-count">{activeOrders.length}</span> : null}
          </button>
          <div className="menu-wrap">
            <button className="btn btn-sm btn-ghost" aria-label="Report or block" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>⋯</button>
            {menuOpen && (
              <div className="menu-pop" role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <button role="menuitem" onClick={() => { setMenuOpen(false); setReport({}); }}>Report {firstName(other?.name)}</button>
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
        {role === "SELLER" && other?.minorStatus && (
          <div className="integrity-banner" role="note" style={{ background: "var(--pink-soft)" }}>
            {firstName(other.name)} is under 18. Their parent or guardian gets receipts for every order. Never share phone numbers, emails, social media or outside meeting links: with a student under 18 that is a high-severity safety issue.
          </div>
        )}

        <div
          className="thread-body ph-no-capture"
          ref={bodyRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) setPendingFile(file);
          }}
        >
          {messages.length === 0 && (
            <div className="stack-sm" style={{ textAlign: "center", margin: "auto", alignItems: "center" }}>
              <p className="text-muted" style={{ margin: 0 }}>
                {isBuyer ? "Say hello. Buying unlocks once your mentor replies, or after your free intro call." : "No messages yet."}
              </p>
              {isBuyer && <AboutYouNudge />}
            </div>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className={`msg-bubble ${m.senderId === userId ? "msg-mine" : "msg-theirs"}${MOMENTS.messages && liveAfter && !knownIds.current.has(m.id) ? " mm-new" : ""}`}>
              {m.sender?.role === "ADMIN" && (
                <div style={{ marginBottom: 4 }}><StaffBadge /></div>
              )}
              <MessageText text={m.body} />
              {m.attachmentUrl && (
                <div style={{ marginTop: m.body ? 6 : 0 }}>
                  <a href={`/api/files/message/${m.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", fontSize: 13 }}>
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
          {sentTick > 0 && <span key={sentTick} className="mm-sent text-muted small" style={{ alignSelf: "flex-end" }} aria-hidden="true">Sent ✓</span>}
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
      {isBuyer && other && (
        <BookCallModal open={bookOpen} onClose={() => setBookOpen(false)} mentorId={convo.sellerId} mentorName={other.name} mentorPhotoUrl={other.photoUrl} onBooked={loadCtx} />
      )}
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

      <aside id="thread-side" className={`thread-side ${showSide ? "show" : ""}`}>
        <div className="stack-sm" style={{ alignItems: "center", textAlign: "center", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <PersonAvatar person={other} size={64} />
          <b>{other?.name}</b>
          {role !== "SELLER" && (
            <Link href={`/mentors/${convo.seller.id}`} className="link small">View profile</Link>
          )}
        </div>

        {/* Mentors: the student's "About you" (lib/studentProfile.ts). */}
        {role === "SELLER" && <StudentCard key={convo.buyerId} studentId={convo.buyerId} title="About them" hideName />}

        {activeOrders.length > 0 && <b>Active packages</b>}
        {activeOrders.map((o) => {
          const next = hoursSummary(o).upcoming[0];
          return (
            <PackageRow
              key={o.id}
              p={o}
              audience={role === "SELLER" ? "mentor" : "student"}
              card
              showCalls
              actions={
                <>
                  <Link href={`/orders/${o.id}`} className="btn btn-sm">Open package</Link>
                  {next && <Link href={`/calls/${next.id}`} className="link small">Next call {fmtDateTime(next.startTime)}</Link>}
                </>
              }
            />
          );
        })}

        <b style={{ marginTop: 6 }}>Files</b>
        <SharedFiles files={messages.filter((m: any) => m.attachmentUrl).reverse()} viewerId={userId} />

        {isBuyer && gigs.length > 0 && (
          <>
            <b style={{ marginTop: 6 }}>{firstName(convo.seller.name)}&apos;s packages</b>
            {!bookable && <span className="text-muted">Booking unlocks once {firstName(convo.seller.name)} replies.</span>}
            {gigs.map((g) => (
              <div key={g.id} className="card stack-sm" style={{ padding: 16 }}>
                <div className="between" style={{ alignItems: "flex-start" }}>
                  <b style={{ fontSize: 15 }}>{g.title}</b>
                  <b>{money(g.price)}</b>
                </div>
                {/* Bought from the mentor's profile (a pop-up there) since the hourly redesign. */}
                <button onClick={() => router.push(`/mentors/${convo.sellerId}?package=${g.id}`)} className="btn btn-primary btn-sm">
                  Details
                </button>
              </div>
            ))}
          </>
        )}

        {pastOrders.length > 0 && (
          <Collapsible title="Past packages" count={pastOrders.length}>
            {pastOrders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="between small">
                <span>{o.packageTitle || o.gig?.title}</span>
                <StatusBadge order={o} audience={role === "SELLER" ? "mentor" : "student"} />
              </Link>
            ))}
          </Collapsible>
        )}
      </aside>
    </>
  );
}
