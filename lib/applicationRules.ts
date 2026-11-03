// Rules for the public mentor application form, shared by the form and
// its API routes so the browser and the server agree.

export const BLURB_MIN_WORDS = 20;
export const BLURB_MAX_WORDS = 100;
export const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5MB

// PDF or Word only.
export const RESUME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const APPLICATION_LIMITS = {
  name: 100,
  email: 254,
  phone: 30,
  medicalSchool: 150,
  undergradSchool: 120,
  residency: 150,
  blurbChars: 1500,
};

// "Where are you now?" on the application. MEDICAL is stored as empty, like
// every application from before these options.
export const APPLICATION_STAGES = [
  { value: "MEDICAL", label: "Medical student or resident" },
  { value: "UNDERGRAD", label: "Undergrad (BS/MD)" },
  { value: "GAP_YEAR", label: "Gap year" },
  { value: "OTHER", label: "Something else" },
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number]["value"];

// The applicant's stage: older rows have none, and a college means BS/MD.
export function applicantStage(app: { trainingStage?: string | null; undergradSchool?: string | null }): ApplicationStage {
  if (app.trainingStage === "UNDERGRAD" || app.trainingStage === "GAP_YEAR" || app.trainingStage === "OTHER") return app.trainingStage;
  return app.undergradSchool ? "UNDERGRAD" : "MEDICAL";
}

// The applicant's school as the team reads it (admin, emails, Sheet, CSV).
export function applicationSchool(app: { trainingStage?: string | null; medicalSchool?: string | null; undergradSchool?: string | null }): string {
  const stage = applicantStage(app);
  const med = app.medicalSchool ? `, ${app.medicalSchool}` : "";
  if (stage === "UNDERGRAD") return `Undergrad at ${app.undergradSchool} (BS/MD)${med}`;
  if (stage === "GAP_YEAR") return `Gap year, ${app.undergradSchool}${med}`;
  if (stage === "OTHER") return `Other, ${app.undergradSchool}${med}`;
  return app.medicalSchool || "";
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function resumeExtension(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext in RESUME_TYPES ? ext : null;
}

// Name of the hidden "website" field. Real people never see it, so a
// value in it means a bot filled in the form.
export const HONEYPOT_FIELD = "website";
