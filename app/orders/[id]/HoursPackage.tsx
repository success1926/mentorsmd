"use client";

// One hours package (redesign Oct 2026, docs/redesign-2026-10.md sections
// 4, 5 and 8). The student's package page: the 48-hour decision banner,
// hours meter, booking calls from the hours, "Running low? Add hours", the
// package's messages and shared files, and the hours log. The mentor's
// package workspace: totals (hours used / left, calls held, earned so far),
// log written work, recordings of their calls, messages and files, and
// "Mark work complete".
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDisputeThread } from "@/lib/hooks/useDisputeThread";
import { Attendance, CallRow, PastCallOutcome, Recordings } from "@/components/Calls";
import { AddHoursModal, BookCallModal, DecisionBanner, HoursLog, HoursMeter, LogWrittenWork, PackageBadge, showLowHours, PackageThread, SuggestHoursModal, ReportProblem, SharedFiles, fmtDay, fmtWhen, postJson } from "@/components/Packages";
import { MinorBadge, StaffBadge, tintFor, initialsOf } from "@/components/ui";
import { ReportDialog } from "@/components/Safety";
import { hoursSummary, shortHours, LOW_HOURS_MINUTES } from "@/lib/hours";
import { finishPhase, markCompleteBlocker } from "@/lib/finishing";
import { hoursLabel, priceFor } from "@/lib/pricing";
import { FORMATS, labelFor, money } from "@/lib/options";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { RECORDING_NOTICE, joinState } from "@/lib/calls";
import { PAYOUT_STATUS_LABEL, nextPayoutDay, payoutDayLabel, periodLabel } from "@/lib/payoutRules";

const KIND_LABEL: Record<string, string> = { HOURLY: "Hourly", BUNDLE: "Hour bundle", SPECIALIZED: "Specialized package", PAY_PER_CALL: "Pay-per-call" };
const first = (n?: string | null) => (n || "").split(" ")[0];
const ADMIN_PHASE: Record<string, string> = {
  PAYING: "Awaiting payment",
  WORKING: "Active",
  AWAITING_STUDENT: "Marked complete, waiting on the student",
  DISPUTED: "Disputed (hours held from payout)",
  APPROVED: "Approved",
  CLOSED: "Closed",
};


function Avatar({ person, size = 44 }: { person: any; size?: number }) {
  return person?.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photoUrl} alt="" className="avatar" style={{ width: size, height: size, objectFit: "cover" }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, background: tintFor(person?.id || person?.name || "") }}>{initialsOf(person?.name || "")}</span>
  );
}

export function HoursPackage({ order, viewer, reload }: { order: any; viewer: any; reload: () => void }) {
  const isBuyer = viewer.id === order.buyerId;
  const isSeller = viewer.id === order.sellerId;
  const isAdmin = viewer.role === "ADMIN";
  const other = isSeller ? order.buyer : order.seller;
  const phase = finishPhase(order);
  const h = hoursSummary(order);
  const now = new Date();
  const upcoming = (order.callBookings || []).filter((b: any) => b.status === "BOOKED" && new Date(b.endTime) > now);
  const past = (order.callBookings || []).filter((b: any) => b.status !== "CANCELLED" && joinState(b) === "ended");
  const title = order.packageTitle || order.gig?.title;

  const [flash, setFlash] = useState<"" | "paid" | "hours" | "topup-cancelled">("");
  const [booking, setBooking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addPreset, setAddPreset] = useState<number | undefined>(undefined);
  const [suggesting, setSuggesting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [slowPayment, setSlowPayment] = useState(false);
  // Blocked either way: upcoming calls can be cancelled any time.
  const [blocked, setBlocked] = useState(false);
  const otherId = isSeller ? order.buyerId : isBuyer ? order.sellerId : "";
  useEffect(() => {
    if (!otherId) return;
    fetch(`/api/blocks?userId=${encodeURIComponent(otherId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBlocked(!!(d.iBlocked || d.theyBlocked)))
      .catch(() => {});
  }, [otherId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [disputeDraft, setDisputeDraft] = useState("");
  const { messages: disputeMessages, sendMessage: sendDisputeMessage } = useDisputeThread(order.disputed ? order.id : "");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFlash(q.get("success") === "true" ? "paid" : q.get("hours_added") ? "hours" : q.get("topup") === "cancelled" ? "topup-cancelled" : "");
    // From the "Mentor suggests more hours" email: open Add hours with that number picked.
    const preset = Number(q.get("add_hours"));
    if (preset && isBuyer && finishPhase(order) === "WORKING") {
      setAddPreset(preset);
      setAdding(true);
    }
  }, []);
  // Waiting for Stripe's confirmation: keep checking every few seconds
  // (for up to 2 minutes) until the webhook has marked it paid. If it's
  // slow, a few times ask the server to check the Stripe page itself.
  useEffect(() => {
    if (order.status !== "PENDING_PAYMENT" || flash !== "paid") return;
    const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      if (tries >= 40) {
        clearInterval(t);
        setSlowPayment(true);
      }
      if (sessionId && [2, 5, 10, 20, 40].includes(tries)) await postJson(`/api/orders/${order.id}/confirm-payment`, { sessionId }).catch(() => null);
      reload();
    }, 3000);
    return () => clearInterval(t);
  }, [order.status, order.id, flash, reload]);

  const canBook = isBuyer && phase === "WORKING" && h.left >= 30;
  const blocker = markCompleteBlocker({ ...order, upcomingCalls: upcoming.length });
  const earnedCents = Math.round(priceFor(h.used, order.rateCents || 0) * (100 - PLATFORM_FEE_PERCENT) / 100);
  const unusedCents = Math.round(priceFor(h.left, order.rateCents || 0) * (100 - PLATFORM_FEE_PERCENT) / 100);
  const takenSlot = order.kind === "PAY_PER_CALL" && order.requestedCallStart && !(order.callBookings || []).some((b: any) => b.status === "BOOKED");

  async function markComplete() {
    if (!confirm(`Mark ${title} complete? ${first(order.buyer?.name) || "The student"} then has 48 hours to approve it or ask for one last call or revision.`)) return;
    setBusy(true);
    setError("");
    const r = await postJson(`/api/orders/${order.id}/finish`, { action: "MARK_COMPLETE" });
    setBusy(false);
    if (!r.ok) setError(r.data.error || "Something went wrong.");
    else reload();
  }

  async function review() {
    setBusy(true);
    const r = await postJson(`/api/orders/${order.id}/review`, { rating: reviewRating, comment: reviewComment || undefined });
    setBusy(false);
    if (!r.ok) setError(r.data.error || "Couldn't save your review.");
    else reload();
  }

  return (
    <div className="page">
      <Link href={isSeller ? "/dashboard" : isAdmin ? "/admin" : "/orders"} className="link small" style={{ display: "inline-block", marginBottom: 20 }}>
        ← {isSeller ? "Dashboard" : isAdmin ? "Admin" : "My packages"}
      </Link>

      <div className="between" style={{ alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div className="stack-sm">
          <span className="text-muted">{KIND_LABEL[order.kind] || "Package"} · {isSeller ? `with ${order.buyer?.name}` : `with ${order.seller?.name}`}</span>
          <h1 className="page-title" style={{ fontSize: "clamp(30px, 3.4vw, 42px)" }}>{title}</h1>
          <div className="row-wrap">
            <PackageBadge order={order} />
            {isSeller && <MinorBadge person={order.buyer} />}
          </div>
        </div>
        {canBook && (
          <button className="btn btn-primary" onClick={() => setBooking(true)}>Book a call</button>
        )}
      </div>

      <div className="order-grid">
        <div className="stack-lg" style={{ gap: 20 }}>
          {flash === "paid" && order.status === "IN_ESCROW" && (
            <div className="alert alert-success">
              {order.creditAppliedCents > 0 && order.creditAppliedCents >= order.amount ? "Paid with your MentorsMD credit." : "Payment received."} Your hours are ready: book a call or send your mentor something to review.
            </div>
          )}
          {order.status === "PENDING_PAYMENT" && (
            <div className="alert">
              {slowPayment
                ? "Still confirming your payment with Stripe. Refresh this page in a minute. If you were charged and it still says this, contact us and we'll sort it out."
                : "Confirming your payment with Stripe… this page updates in a few seconds."}
            </div>
          )}
          {flash === "hours" && <div className="alert alert-success">Thanks! Your hours are added as soon as the payment goes through (refresh in a few seconds if you don&apos;t see them yet).</div>}
          {flash === "topup-cancelled" && <div className="alert">No hours were added and nothing was charged.</div>}
          {takenSlot && isBuyer && (
            <div className="alert alert-warning row-wrap" style={{ justifyContent: "space-between" }}>
              <span>Your call is paid for, but the time you picked ({fmtWhen(order.requestedCallStart)}) was taken while you were paying. Please pick another time.</span>
              <button className="btn btn-sm" onClick={() => setBooking(true)}>Pick a new time</button>
            </div>
          )}

          {(isBuyer || isSeller) && <DecisionBanner order={order} isBuyer={isBuyer} onChanged={reload} />}

          {phase === "WORKING" && order.lastRequestNote && (order.lastCallUsedAt || order.lastRevisionUsedAt) && (
            <div className="card stack-sm" style={{ borderColor: "var(--tint-2)" }}>
              <b>{isSeller ? `${first(order.buyer?.name)} asked for` : "You asked for"} {order.lastCallUsedAt ? "one last call" : "one last revision"}</b>
              <p className="text-secondary" style={{ whiteSpace: "pre-wrap" }}>{order.lastRequestNote}</p>
              <span className="text-muted small">{isSeller ? "When it's done, mark the work complete again. They'll then have 48 hours to approve." : "When your mentor marks the work complete again, you'll have 48 hours to approve."}</span>
            </div>
          )}

          {phase === "APPROVED" && (
            <div className="alert alert-success">
              {order.autoApproved ? "Approved automatically after 48 hours." : "Approved."}{" "}
              {isSeller ? `Your earnings for it, including unused hours, are paid with the monthly payout on the 24th.` : "Thanks for working with MentorsMD."}
            </div>
          )}

          {/* Hours */}
          <div className="card stack" style={{ gap: 16 }}>
            <div className="between"><b style={{ fontSize: 18 }}>Hours</b>{order.rateCents ? <span className="text-muted small">{money(order.rateCents)} an hour</span> : null}</div>
            <HoursMeter order={order} />
            {isBuyer && phase === "WORKING" && (
              <div className="row-wrap">
                <button className="btn btn-primary btn-sm" disabled={h.left < 30} onClick={() => setBooking(true)}>Book a call from your hours</button>
                <span className="text-muted small">{h.left >= 30 ? "30 or 60 minutes, on your mentor's calendar. No payment needed." : "No hours left for a call."}</span>
              </div>
            )}
            {isBuyer && (phase === "WORKING" || phase === "AWAITING_STUDENT") && (
              <div className={`alert ${h.left <= LOW_HOURS_MINUTES ? "alert-warning" : "alert-blue"} row-wrap`} style={{ justifyContent: "space-between" }}>
                <span>{h.left <= LOW_HOURS_MINUTES ? `Running low? You have ${shortHours(h.left)} left.` : "Need more time? Add hours at the same rate."}</span>
                <button className="btn btn-sm" onClick={() => setAdding(true)}>Add hours</button>
              </div>
            )}
            {isSeller && showLowHours(order) && (
              <div className="alert alert-warning">
                {order.buyer?.name?.split(" ")[0] || "Your student"} has {shortHours(h.left)} left (booked calls count as used). We&apos;ve emailed them a reminder that they can add hours. If the work needs more time than that, suggest how many more hours you expect.
              </div>
            )}
            {isSeller && phase === "WORKING" && (
              <div className="row-wrap">
                <button className="btn btn-sm" onClick={() => setSuggesting(true)}>Suggest more hours</button>
                <span className="text-muted small">If the work will take longer than the hours left. {order.buyer?.name?.split(" ")[0] || "The student"} gets a message and a one-click Add hours button.</span>
              </div>
            )}
            {isSeller && phase === "WORKING" && (
              <div className="stack-sm">
                <b className="small">Log written work</b>
                <LogWrittenWork order={order} onLogged={reload} />
              </div>
            )}
          </div>

          {/* Calls */}
          {(upcoming.length > 0 || past.length > 0) && (
            <div className="card stack" style={{ gap: 12 }}>
              <b style={{ fontSize: 18 }}>Calls</b>
              {upcoming.map((b: any) => (
                <CallRow key={b.id} booking={b} order={order} canManage={isBuyer || isSeller} isSeller={isSeller} isAdmin={isAdmin} blocked={blocked} onChanged={reload} />
              ))}
              {past.length > 0 && (
                <div className="stack-sm">
                  <b className="small">Past calls</b>
                  {past.map((b: any) => (
                    <div key={b.id} className="stack-sm" style={{ gap: 4 }}>
                      <span className="small">{fmtWhen(b.startTime)} · {Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000)} min</span>
                      <PastCallOutcome booking={b} order={order} viewer={isBuyer ? "student" : isSeller ? "mentor" : "admin"} />
                      {!isBuyer && <Attendance booking={b} order={order} />}
                      {(isSeller || isAdmin) && b.recordings && <Recordings booking={b} watchUrl={isSeller ? (id) => `/api/orders/${order.id}/recordings/${id}` : undefined} />}
                    </div>
                  ))}
                </div>
              )}
              <p className="notice">{isSeller ? "You can watch recordings of your own calls here. They're deleted 60 days after the package is closed." : RECORDING_NOTICE}</p>
            </div>
          )}

          {/* Dispute thread */}
          {order.disputed && (
            <div className="card stack" style={{ borderColor: "#F3D0D0" }}>
              <b>Dispute: conversation with the MentorsMD team</b>
              <span className="text-secondary">An admin reviews it and decides. Reply here if they ask for more details.</span>
              <div className="msg-thread ph-no-capture">
                {disputeMessages.length === 0 && <p className="text-muted">Loading…</p>}
                {disputeMessages.map((m: any) => (
                  <div key={m.id} className={`msg-bubble ${m.sender?.role === "ADMIN" ? "msg-theirs" : "msg-mine"}`}>
                    <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>{m.sender?.name} {m.sender?.role === "ADMIN" && <StaffBadge />}</div>
                    {m.body}
                  </div>
                ))}
              </div>
              {order.status === "IN_ESCROW" && (
                <div className="row">
                  <input className="input grow" style={{ marginBottom: 0 }} placeholder="Reply…" value={disputeDraft} onChange={(e) => setDisputeDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && disputeDraft.trim()) { sendDisputeMessage(disputeDraft); setDisputeDraft(""); } }} />
                  <button className="btn" onClick={() => { if (disputeDraft.trim()) { sendDisputeMessage(disputeDraft); setDisputeDraft(""); } }}>Send</button>
                </div>
              )}
            </div>
          )}

          {/* Messages + shared files */}
          {(isBuyer || isSeller) && order.conversationId && (
            <div className="card" id="messages" style={{ scrollMarginTop: 90 }}><PackageThread order={order} viewerId={viewer.id} /></div>
          )}

          {/* Hours log */}
          <div className="card stack" style={{ gap: 10 }}>
            <b style={{ fontSize: 18 }}>Hours log</b>
            <HoursLog entries={order.hourEntries} />
          </div>

          {/* Review */}
          {isBuyer && phase === "APPROVED" && !order.review && (
            <div className="card stack">
              <b>Leave a review for {first(order.seller?.name)}</b>
              <div className="row" style={{ gap: 4 }} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={reviewRating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setReviewRating(n)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 28, color: n <= reviewRating ? "var(--primary)" : "var(--line)", padding: 0 }}>★</button>
                ))}
              </div>
              <textarea className="input" style={{ marginBottom: 0 }} placeholder="What was it like working together? (optional)" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
              <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={!reviewRating || busy} onClick={review}>Submit review</button>
            </div>
          )}
        </div>

        {/* ---------- Side ---------- */}
        <aside className="sticky-side">
          <div className="card stack" style={{ gap: 14 }}>
            <div className="row">
              <Avatar person={other} />
              <div className="stack-sm" style={{ gap: 0 }}>
                <span className="text-muted">{isSeller ? "Student" : "Mentor"}</span>
                <b>{other?.name}</b>
              </div>
            </div>
            <hr className="divider" />
            <div className="stack-sm small">
              <div className="between"><span className="text-secondary">Bought</span><span>{hoursLabel(order.minutesPurchased - (order.topUps || []).reduce((s: number, t: any) => s + t.minutes, 0))} · {money(order.amount)}</span></div>
              {(order.topUps || []).map((t: any) => (
                <div key={t.id} className="between"><span className="text-secondary">Hours added {t.paidAt ? fmtDay(t.paidAt) : ""}</span><span>{hoursLabel(t.minutes)} · {money(t.amountCents)}</span></div>
              ))}
              {order.creditAppliedCents > 0 && <div className="between"><span className="text-secondary">Credit applied</span><span>{money(order.creditAppliedCents)}</span></div>}
              {order.format && <div className="between"><span className="text-secondary">Format</span><span>{labelFor(FORMATS, order.format)}</span></div>}
              <div className="between"><span className="text-secondary">Due date</span><span>None</span></div>
              <div className="between"><span className="text-secondary">Started</span><span>{fmtDay(order.paidAt || order.createdAt)}</span></div>
            </div>
            {order.packageDescription && (
              <details className="collapse">
                <summary style={{ padding: "10px 14px", fontSize: 14 }}>What&apos;s included</summary>
                <div className="collapse-body" style={{ padding: "0 14px 12px" }}><p className="small text-secondary" style={{ whiteSpace: "pre-wrap" }}>{order.packageDescription}</p></div>
              </details>
            )}
          </div>

          {isAdmin && !isBuyer && !isSeller && (
            <div className="card stack" style={{ gap: 10 }}>
              <b>For admins</b>
              <div className="stack-sm small">
                <div className="between"><span className="text-secondary">Kind</span><span>{KIND_LABEL[order.kind] || order.kind}</span></div>
                <div className="between"><span className="text-secondary">Status</span><span>{ADMIN_PHASE[phase] || phase}{phase === "AWAITING_STUDENT" && order.responseDeadline ? ` (until ${fmtWhen(order.responseDeadline)})` : ""}</span></div>
                <div className="between"><span className="text-secondary">Hours bought</span><span>{shortHours(h.purchased)} at {money(order.rateCents || 0)}/hr</span></div>
                <div className="between"><span className="text-secondary">Used / reserved / left</span><span>{shortHours(h.used)} / {shortHours(h.reserved)} / {shortHours(h.left)}</span></div>
                <div className="between"><span className="text-secondary">Added hours</span><span>{money((order.topUps || []).reduce((s: number, t: any) => s + t.amountCents, 0))}</span></div>
                <div className="between"><span className="text-secondary">Credit applied</span><span>{money((order.creditAppliedCents || 0) + (order.topUps || []).reduce((s: number, t: any) => s + (t.creditAppliedCents || 0), 0))}</span></div>
                {order.refundedCreditCents > 0 && <div className="between"><span className="text-secondary">Refunded as credit</span><span>{money(order.refundedCreditCents)}</span></div>}
                {(order.lastCallUsedAt || order.lastRevisionUsedAt) && <div className="between"><span className="text-secondary">Last request</span><span>{order.lastCallUsedAt ? "One last call" : "One last revision"}</span></div>}
                {order.approvedAt && <div className="between"><span className="text-secondary">Approved</span><span>{fmtDay(order.approvedAt)}{order.autoApproved ? " (automatically)" : ""}</span></div>}
                <div className="between"><span className="text-secondary">Hours paid to mentor</span><span>{shortHours((order.hourEntries || []).filter((e: any) => !e.voidedAt && e.payoutId).reduce((s: number, e: any) => s + e.minutes, 0) + (order.payout ? order.unusedMinutesPaid || 0 : 0))}</span></div>
                <div className="between"><span className="text-secondary">Payout</span><span>{order.payout ? `${periodLabel(order.payout.period)} · ${PAYOUT_STATUS_LABEL[order.payout.status] || order.payout.status}` : order.status === "COMPLETED" ? `Next payout, ${payoutDayLabel(nextPayoutDay())}` : "Not settled yet"}</span></div>
              </div>
            </div>
          )}

          {isSeller && (
            <div className="card stack" style={{ gap: 10 }}>
              <b>Your totals</b>
              <div className="stack-sm small">
                <div className="between"><span className="text-secondary">Hours used</span><b>{shortHours(h.used)}</b></div>
                <div className="between"><span className="text-secondary">Hours left</span><b>{shortHours(h.left)}</b></div>
                <div className="between"><span className="text-secondary">Calls held</span><b>{h.callsHeld}</b></div>
                <div className="between"><span className="text-secondary">Earned so far</span><b>{money(earnedCents)}</b></div>
                {h.left > 0 && phase !== "CLOSED" && <div className="between"><span className="text-secondary">Unused hours, paid on approval</span><span>{money(unusedCents)}</span></div>}
              </div>
              <span className="text-muted small">
                {order.payout
                  ? `Settled in your ${periodLabel(order.payout.period)} payout (${(PAYOUT_STATUS_LABEL[order.payout.status] || order.payout.status).toLowerCase()}).`
                  : `You earn ${100 - PLATFORM_FEE_PERCENT}% of each hour, paid monthly. Next payout: ${payoutDayLabel(nextPayoutDay())}.`}
                {order.disputed && !order.disputeResolvedAt ? " Hours on this package are held until the dispute is decided." : ""}
              </span>
            </div>
          )}

          {isSeller && (
            <div className="stack-sm">
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--muted)", alignSelf: "flex-start" }} onClick={() => setReporting(true)}>
                Report a problem with {first(order.buyer?.name) || "this student"}
              </button>
              <span className="text-muted small">Asked to do something you&apos;re not comfortable with? Tell us privately. You can also block them, which stops messages and calls (you can cancel booked calls any time) until we&apos;ve looked into it.</span>
            </div>
          )}

          {isSeller && phase === "WORKING" && (
            <div className="card stack-sm">
              <button className="btn btn-deep btn-block" disabled={!!blocker || busy} onClick={markComplete}>Mark work complete</button>
              <span className="text-muted small">{blocker || "When you're done (any time). The student then has 48 hours to approve, or to ask for one last call or revision."}</span>
            </div>
          )}

          {(isBuyer || isSeller) && (
            <div className="card stack-sm">
              <b>Shared files</b>
              <SharedFiles files={order.files} viewerId={viewer.id} />
            </div>
          )}

          {isBuyer && phase === "WORKING" && (
            <div className="card stack-sm">
              <span className="text-muted small">Something wrong? Message your mentor first. If that doesn&apos;t sort it out:</span>
              <ReportProblem orderId={order.id} onChanged={reload} />
            </div>
          )}

          {error && <div role="alert" className="alert alert-danger">{error}</div>}
        </aside>
      </div>

      {isBuyer && (
        <>
          <BookCallModal open={booking} onClose={() => setBooking(false)} mentorId={order.sellerId} mentorName={order.seller?.name} mentorPhotoUrl={order.seller?.photoUrl} orderId={order.id} minutesLeft={h.left} onBooked={reload} />
          <AddHoursModal open={adding} onClose={() => setAdding(false)} order={order} initialHours={addPreset} />
        </>
      )}
      {isSeller && <SuggestHoursModal open={suggesting} onClose={() => setSuggesting(false)} order={order} />}
      {isSeller && order.buyer && (
        <ReportDialog
          open={reporting}
          onClose={() => setReporting(false)}
          subject={{ id: order.buyerId, name: order.buyer.name || "Student" }}
          conversationId={order.conversationId || undefined}
          orderId={order.id}
          onDone={(didBlock) => {
            if (!didBlock) return;
            setBlocked(true);
            reload();
          }}
        />
      )}
    </div>
  );
}
