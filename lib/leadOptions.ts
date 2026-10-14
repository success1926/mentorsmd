// Leads inbox labels and form limits. Safe to import in the browser.

export const LEAD_KINDS = ["APPLICATION", "CONTACT", "WAITLIST"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];
export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  APPLICATION: "Mentor applications",
  CONTACT: "Contact messages",
  WAITLIST: "Waitlist",
};

// Status for contact messages and waitlist signups.
export const LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export const isLeadStatus = (v: unknown): v is LeadStatus => LEAD_STATUSES.some((s) => s.value === v);
export const leadStatusLabel = (v: string) => LEAD_STATUSES.find((s) => s.value === v)?.label ?? v;

// Mentor applications keep their own decision (Pending / Invited /
// Declined, with the Invite and Decline buttons). In the inbox they map
// onto the same three stages: Pending and nobody assigned = New, Pending
// and assigned to someone = In progress, Invited or Declined = Done.
export function applicationStage(a: { status: string; assignedToId: string | null }): LeadStatus {
  if (a.status !== "PENDING") return "DONE";
  return a.assignedToId ? "IN_PROGRESS" : "NEW";
}
export const APPLICATION_STATUS_LABEL: Record<string, string> = { PENDING: "Pending", INVITED: "Invited", DECLINED: "Declined" };

// Contact form
export const CONTACT_TOPICS = [
  { value: "STUDENT", label: "Student question" },
  { value: "MENTOR", label: "Mentor question" },
  { value: "PARENT", label: "Parent" },
  { value: "PRESS", label: "Press" },
  { value: "OTHER", label: "Other" },
] as const;
export const contactTopicLabel = (v: string | null | undefined) => CONTACT_TOPICS.find((t) => t.value === v)?.label ?? "Other";
export const CONTACT_LIMITS = { name: 100, email: 200, messageMin: 10, message: 3000 };

// Waitlist form: the year they plan to apply (this year and the next six).
export function applyYearOptions(now = new Date()) {
  const y = now.getFullYear();
  return Array.from({ length: 7 }, (_, i) => String(y + i));
}
export const isApplyYear = (v: unknown) => typeof v === "string" && /^20[2-4]\d$/.test(v);

export const NOTE_MAX = 2000;
