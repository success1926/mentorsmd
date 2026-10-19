// Finishing an order (redesign Oct 2026, docs/redesign-2026-10.md section 5).
// Pure functions, safe to import from both server and client code.
//
//   1. The mentor clicks "Mark work complete" (any time the order is active,
//      not disputed, not already waiting on the student, and no call is
//      still coming up). The student then has 48 hours.
//   2. The student can Approve, Request one last call, Request one last
//      revision, or Open a dispute. One last call / revision: once per
//      order, and only one of the two; asking for it sends the order back
//      to the mentor (the 48 hours stop).
//   3. When the mentor marks it complete again after that, the student gets
//      a fresh 48 hours with only Approve / Open a dispute.
//   4. No answer by the deadline = approved automatically (cron).
// Approval sets approvedAt and moves the order to COMPLETED ("approved,
// waiting for the monthly payout"; unused hours are paid to the mentor).

type DateLike = string | Date | null | undefined;

export const RESPONSE_WINDOW_HOURS = 48;

export type FinishOrderLike = {
  status: string;
  disputed?: boolean;
  markedCompleteAt?: DateLike;
  responseDeadline?: DateLike;
  lastCallUsedAt?: DateLike;
  lastRevisionUsedAt?: DateLike;
  approvedAt?: DateLike;
};

export type FinishPhase = "PAYING" | "WORKING" | "AWAITING_STUDENT" | "APPROVED" | "DISPUTED" | "CLOSED";
export type StudentAction = "APPROVE" | "LAST_CALL" | "LAST_REVISION";

const t = (d: DateLike) => (d ? new Date(d).getTime() : null);

export function finishPhase(o: FinishOrderLike): FinishPhase {
  if (o.status === "PENDING_PAYMENT") return "PAYING";
  if (o.approvedAt || o.status === "COMPLETED" || o.status === "RELEASED") return "APPROVED";
  if (o.status !== "IN_ESCROW") return "CLOSED"; // refunded / cancelled
  if (o.disputed) return "DISPUTED";
  if (o.markedCompleteAt && o.responseDeadline) return "AWAITING_STUDENT";
  return "WORKING";
}

// The one last call / revision is still available.
export const lastRequestAvailable = (o: FinishOrderLike) => !o.lastCallUsedAt && !o.lastRevisionUsedAt;

export function studentActions(o: FinishOrderLike) {
  const awaiting = finishPhase(o) === "AWAITING_STUDENT";
  const extra = awaiting && lastRequestAvailable(o);
  return { approve: awaiting, dispute: awaiting || finishPhase(o) === "WORKING", lastCall: extra, lastRevision: extra };
}

// Whole hours left to respond (rounded up), or null.
export function hoursToRespond(o: FinishOrderLike, now: Date = new Date()) {
  const d = t(o.responseDeadline);
  if (finishPhase(o) !== "AWAITING_STUDENT" || d === null) return null;
  return Math.max(0, Math.ceil((d - now.getTime()) / 3600_000));
}

// Why the mentor can't mark the work complete right now, or null.
export function markCompleteBlocker(o: FinishOrderLike & { upcomingCalls?: number }): string | null {
  const phase = finishPhase(o);
  if (phase === "AWAITING_STUDENT") return "You've already marked this complete. The student is reviewing it.";
  if (phase === "DISPUTED") return "This order has an open dispute. An admin will resolve it.";
  if (phase !== "WORKING") return "This package isn't active.";
  if ((o.upcomingCalls || 0) > 0) return "A call is still booked on this package. Mark it complete after the call (or cancel it).";
  return null;
}

// What "Mark work complete" changes.
export function markCompletePatch(now: Date = new Date()) {
  return { markedCompleteAt: now, responseDeadline: new Date(now.getTime() + RESPONSE_WINDOW_HOURS * 3600_000) };
}

// What a student's answer changes, or an error.
export function studentActionPatch(o: FinishOrderLike, action: StudentAction, note: string, now: Date = new Date()):
  | { error: string }
  | { patch: Record<string, unknown>; approved: boolean } {
  const can = studentActions(o);
  if (action === "APPROVE") {
    if (!can.approve) return { error: "Your mentor hasn't marked this complete yet." };
    return { patch: { status: "COMPLETED", approvedAt: now, completedAt: now, autoApproved: false, responseDeadline: null }, approved: true };
  }
  if (!can.lastCall) {
    return { error: lastRequestAvailable(o) ? "Your mentor hasn't marked this complete yet." : "You've already used your one last call or revision on this package." };
  }
  if (!note.trim()) return { error: action === "LAST_CALL" ? "Say what you'd like to cover in the last call." : "Say what you'd like changed." };
  return {
    patch: {
      ...(action === "LAST_CALL" ? { lastCallUsedAt: now } : { lastRevisionUsedAt: now }),
      lastRequestNote: note.trim().slice(0, 2000),
      markedCompleteAt: null,
      responseDeadline: null,
    },
    approved: false,
  };
}

// The cron approves orders whose 48 hours have passed.
export function autoApproveDue(o: FinishOrderLike, now: Date = new Date()) {
  const d = t(o.responseDeadline);
  return finishPhase(o) === "AWAITING_STUDENT" && d !== null && d <= now.getTime();
}

export const autoApprovePatch = (now: Date = new Date()) => ({ status: "COMPLETED" as const, approvedAt: now, completedAt: now, autoApproved: true, responseDeadline: null as Date | null });

// Status badge text for new orders (My packages, dashboard).
export function packageStatus(o: FinishOrderLike, now: Date = new Date()): { label: string; tone: "" | "brand" | "warning" | "danger" | "success" | "blue" } {
  const phase = finishPhase(o);
  if (phase === "PAYING") return { label: "Awaiting payment", tone: "" };
  if (phase === "DISPUTED") return { label: "Disputed", tone: "danger" };
  if (phase === "APPROVED") return { label: "Completed", tone: "success" };
  if (phase === "CLOSED") return { label: o.status === "REFUNDED" ? "Refunded" : "Cancelled", tone: "" };
  if (phase === "AWAITING_STUDENT") return { label: `Respond in ${hoursToRespond(o, now)} h`, tone: "warning" };
  if (o.lastCallUsedAt || o.lastRevisionUsedAt) return { label: o.lastCallUsedAt ? "Last call requested" : "Last revision requested", tone: "blue" };
  return { label: "Active", tone: "brand" };
}
