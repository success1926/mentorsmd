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
  residency: 150,
  blurbChars: 1500,
};

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
