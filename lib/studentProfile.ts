// The optional student profile (Oct 2026): a short "about you" so mentors
// know who they're talking to before a call. Every field is optional. Only
// mentors the student has messaged, booked or bought from can see it
// (lib/studentProfileAccess.ts). Pure data and checks, safe to import from
// both server and client code.
import { SERVICES, labelFor, type Option } from "@/lib/options";

export const APPLY_YEARS: Option[] = [
  { value: "2026", label: "2026" },
  { value: "2027", label: "2027" },
  { value: "2028_PLUS", label: "2028 or later" },
];

export const STUDENT_STAGES: Option[] = [
  { value: "SCHOOL_LIST", label: "Building my school list" },
  { value: "PERSONAL_STATEMENT", label: "Personal statement" },
  { value: "PRIMARIES", label: "Primaries" },
  { value: "SECONDARIES", label: "Secondaries" },
  { value: "INTERVIEWS", label: "Interviews" },
  { value: "WAITLISTED", label: "Waitlisted" },
  { value: "REAPPLYING", label: "Reapplying" },
];

export const STUDENT_DEGREES: Option[] = [
  { value: "MD", label: "MD" },
  { value: "DO", label: "DO" },
  { value: "BOTH", label: "MD and DO" },
];

// What students can ask for help with: the same list as mentors' packages,
// without "Other".
export const HELP_OPTIONS: Option[] = SERVICES.filter((s) => s.value !== "OTHER");

export const ABOUT_MAX = 300;
export const SCHOOL_MAX = 80;

export type StudentProfile = {
  applyYear: string | null;
  stage: string | null;
  degree: string | null;
  school: string | null;
  helpWith: string[];
  about: string | null;
};

export const studentProfileSelect = {
  studentApplyYear: true,
  studentStage: true,
  studentDegree: true,
  studentSchool: true,
  studentHelpWith: true,
  studentAbout: true,
  studentProfileAt: true,
} as const;

type Row = { studentApplyYear: string | null; studentStage: string | null; studentDegree: string | null; studentSchool: string | null; studentHelpWith: string[]; studentAbout: string | null };

export function profileFromRow(u: Row): StudentProfile {
  return {
    applyYear: u.studentApplyYear,
    stage: u.studentStage,
    degree: u.studentDegree,
    school: u.studentSchool,
    helpWith: u.studentHelpWith || [],
    about: u.studentAbout,
  };
}

// "Filled in" for the reminders: the three things a mentor most needs.
export function isStudentProfileFilled(p: StudentProfile) {
  return !!(p.applyYear && p.stage && p.helpWith.length);
}
export function isStudentProfileEmpty(p: StudentProfile) {
  return !p.applyYear && !p.stage && !p.degree && !p.school && !p.helpWith.length && !p.about;
}

const isIn = (list: Option[], v: unknown): v is string => typeof v === "string" && list.some((o) => o.value === v);
const line = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// Checks what the student sent. Empty values clear a field.
export function parseStudentProfile(body: any): { data: Row } | { error: string } {
  const pick = (v: unknown, list: Option[], what: string) => {
    if (v === null || v === undefined || v === "") return { ok: null };
    return isIn(list, v) ? { ok: v } : { error: `Pick ${what} from the list` };
  };
  const year = pick(body.applyYear, APPLY_YEARS, "when you're applying");
  if ("error" in year) return { error: year.error! };
  const stage = pick(body.stage, STUDENT_STAGES, "your stage");
  if ("error" in stage) return { error: stage.error! };
  const degree = pick(body.degree, STUDENT_DEGREES, "MD, DO or both");
  if ("error" in degree) return { error: degree.error! };
  const help = Array.isArray(body.helpWith) ? body.helpWith : [];
  if (!help.every((h: unknown) => isIn(HELP_OPTIONS, h))) return { error: "Pick what you want help with from the list" };
  if (typeof body.about === "string" && body.about.trim().length > ABOUT_MAX) return { error: `Please keep "About you" under ${ABOUT_MAX} characters` };
  const about = typeof body.about === "string" ? body.about.trim().slice(0, ABOUT_MAX) : "";
  const school = line(body.school, SCHOOL_MAX);
  return {
    data: {
      studentApplyYear: year.ok ?? null,
      studentStage: stage.ok ?? null,
      studentDegree: degree.ok ?? null,
      studentSchool: school || null,
      studentHelpWith: Array.from(new Set(help as string[])),
      studentAbout: about || null,
    },
  };
}

// One-line labels for the mentor's card.
export function profileLines(p: StudentProfile) {
  return {
    applying: p.applyYear ? `Applying ${labelFor(APPLY_YEARS, p.applyYear)}` : "",
    stage: p.stage ? labelFor(STUDENT_STAGES, p.stage) : "",
    degree: p.degree ? labelFor(STUDENT_DEGREES, p.degree) : "",
    helpWith: p.helpWith.map((h) => labelFor(HELP_OPTIONS, h)).filter(Boolean),
  };
}
