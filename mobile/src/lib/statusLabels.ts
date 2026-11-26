import type { ChipTone } from "../components/ui";
import { finishPhase, hoursToRespond, type FinishLike } from "./orders";

// One place for what an order's status is called and which colour it gets.
// A copy of the website's lib/statusLabels.ts orderStatus(): keep the two
// the same (labels per audience, and the same tone for each status).
// The website's tones map onto the app's badge (Chip) colours below.

export type StatusTone = "neutral" | "brand" | "warning" | "danger" | "success" | "blue" | "pink";
export type StatusAudience = "student" | "mentor";
export type StatusLabel = { label: string; tone: StatusTone };

export const TONE_CHIP: Record<StatusTone, ChipTone> = {
  neutral: "gray",
  brand: "plain",
  warning: "warn",
  danger: "bad",
  success: "ok",
  blue: "blue",
  pink: "pink",
};

export type StatusOrderLike = FinishLike & { disputeResolvedAt?: string | Date | null };

export function orderStatus(o: StatusOrderLike, audience: StatusAudience = "student", now: Date = new Date()): StatusLabel {
  const disputeOpen = !!o.disputed && !o.disputeResolvedAt;
  if (o.status === "REFUNDED") return { label: "Refunded as credit", tone: "pink" };
  if (o.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };
  if (o.status === "PENDING_PAYMENT") return { label: "Awaiting payment", tone: "neutral" };
  if (disputeOpen && (o.status === "IN_ESCROW" || o.status === "COMPLETED")) return { label: "Disputed", tone: "danger" };
  if (o.status === "RELEASED") return { label: audience === "student" ? "Completed" : "Paid out", tone: "success" };
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
