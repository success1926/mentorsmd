import { finishPhase, hoursToRespond, type FinishOrderLike } from "./finishing";

// One place for what an order's status is called and which colour it gets.
// Student, mentor and admin pages all use this, so the same package always
// shows the same colour; only a few words change with who is looking.
// No server imports: client pages and the phone app's mirror can use it.

export type StatusTone = "neutral" | "brand" | "warning" | "danger" | "success" | "blue" | "pink";
export type StatusAudience = "student" | "mentor" | "admin";
export type StatusLabel = { label: string; tone: StatusTone };

export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "badge",
  brand: "badge badge-brand",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
  success: "badge badge-success",
  blue: "badge badge-blue",
  pink: "badge badge-pink",
};

export type StatusOrderLike = FinishOrderLike & { disputeResolvedAt?: string | Date | null };

export function orderStatus(o: StatusOrderLike, audience: StatusAudience = "student", now: Date = new Date()): StatusLabel {
  const disputeOpen = !!o.disputed && !o.disputeResolvedAt;
  if (o.status === "REFUNDED") return { label: "Refunded as credit", tone: "pink" };
  if (o.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };
  if (o.status === "PENDING_PAYMENT") return { label: "Awaiting payment", tone: "neutral" };
  if (disputeOpen && (o.status === "IN_ESCROW" || o.status === "COMPLETED")) return { label: audience === "admin" ? "Disputed (hours held)" : "Disputed", tone: "danger" };
  if (o.status === "RELEASED") return { label: audience === "student" ? "Completed" : audience === "mentor" ? "Paid out" : "Paid to mentor", tone: "success" };
  if (o.status === "COMPLETED") return { label: audience === "student" ? "Approved" : "Approved, paid on the 24th", tone: "blue" };
  const phase = finishPhase({ ...o, disputed: disputeOpen });
  if (phase === "AWAITING_STUDENT") {
    if (audience === "student") return { label: `Respond in ${hoursToRespond(o, now) ?? 0} h`, tone: "warning" };
    return { label: "Waiting on student", tone: "warning" };
  }
  if (o.lastCallUsedAt || o.lastRevisionUsedAt) return { label: o.lastCallUsedAt ? "Last call requested" : "Last revision requested", tone: "blue" };
  if (o.status === "IN_ESCROW") return { label: "Active", tone: "brand" };
  return { label: o.status, tone: "neutral" };
}

export const statusClass = (s: StatusLabel) => TONE_CLASS[s.tone];
