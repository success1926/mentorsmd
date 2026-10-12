// The legal documents edited in Admin -> Legal (#99). Safe to import in
// the browser (no database code here); the database side is lib/legal.ts.

export const LEGAL_KINDS = ["TERMS", "PRIVACY", "COMMUNITY_GUIDELINES", "MENTOR_AGREEMENT", "PARENTAL_CONSENT"] as const;
export type LegalKind = (typeof LEGAL_KINDS)[number];

export const LEGAL_INFO: Record<LegalKind, { label: string; path: string; who: string }> = {
  TERMS: { label: "Terms of Service", path: "/terms", who: "Students and mentors" },
  PRIVACY: { label: "Privacy Policy", path: "/privacy", who: "Students and mentors" },
  COMMUNITY_GUIDELINES: { label: "Community Guidelines", path: "/community-guidelines", who: "Students and mentors" },
  MENTOR_AGREEMENT: { label: "Mentor Agreement", path: "/mentor-agreement", who: "Mentors" },
  PARENTAL_CONSENT: { label: "Parental Consent form", path: "/parental-consent", who: "Parents of students aged 13-17" },
};

export function isLegalKind(v: unknown): v is LegalKind {
  return typeof v === "string" && (LEGAL_KINDS as readonly string[]).includes(v);
}

// Which documents each kind of account must accept. Parents sign the
// parental consent form separately (lib/minors.ts); admins accept nothing.
export function requiredKindsFor(role: string | null | undefined): LegalKind[] {
  if (role === "SELLER") return ["TERMS", "PRIVACY", "COMMUNITY_GUIDELINES", "MENTOR_AGREEMENT"];
  if (role === "BUYER") return ["TERMS", "PRIVACY", "COMMUNITY_GUIDELINES"];
  return [];
}

// ---- Age rules (#104, #106, #107, #112) ----
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

// "YYYY-MM-DD" -> a Date at UTC midnight, or null if it isn't a real,
// plausible date of birth.
export function parseDob(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  if (d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) return null;
  return d;
}

// Whole years old on `now` (UTC dates).
export function ageOn(dob: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export const UNDER_13_MESSAGE = "Sorry, you need to be at least 13 years old to use MentorsMD.";
