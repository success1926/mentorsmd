// Reasons people can pick when they report someone (Report button in a
// conversation or on a profile). Severity: 3 = admins get an email now.
export const REPORT_REASONS = [
  { value: "GHOSTWRITING", label: "Offered to write, or asked me to write, an essay or application", severity: 2 },
  { value: "OFF_SITE_PAYMENT", label: "Asked to pay outside MentorsMD (Venmo, Zelle, PayPal, cash...)", severity: 3 },
  { value: "OFF_SITE_CONTACT", label: "Pushed to talk or meet outside MentorsMD", severity: 2 },
  { value: "CREDENTIALS", label: "Asked for my password or login details (AMCAS etc.)", severity: 3 },
  { value: "HARASSMENT", label: "Harassment, threats or hateful language", severity: 3 },
  { value: "INAPPROPRIATE", label: "Sexual or otherwise inappropriate messages", severity: 3 },
  { value: "SCAM", label: "Scam, fake credentials or impersonation", severity: 3 },
  { value: "SPAM", label: "Spam or advertising", severity: 1 },
  { value: "QUALITY", label: "Didn't do what was promised / unprofessional", severity: 1 },
  { value: "OTHER", label: "Something else", severity: 1 },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export function reportReason(value: unknown) {
  return REPORT_REASONS.find((r) => r.value === value) || null;
}
