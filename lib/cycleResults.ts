// Cycle results (Oct 2026, ported from AdmitMD's portal "Cycle Results"):
// students record their application outcomes, one row per school (the
// CycleResult table). Pure data and checks, safe to import anywhere.
//
// Switched off until NEXT_PUBLIC_CYCLE_RESULTS=1 is set (Vercel, then
// redeploy: it's read when the site is built). While it's off there are no
// links to it anywhere, /dashboard/results and /admin/results are "page
// not found", and the APIs refuse. Nothing public uses this data yet.
import { MEDICAL_SCHOOL_MAX, normalizeMedicalSchool } from "@/lib/medicalSchools";

export const CYCLE_RESULTS_ON = process.env.NEXT_PUBLIC_CYCLE_RESULTS === "1";

export const RESULT_STATUSES = [
  { value: "APPLIED", label: "Applied" },
  { value: "SECONDARY", label: "Secondary received" },
  { value: "INTERVIEW_INVITE", label: "Interview invite" },
  { value: "INTERVIEWED", label: "Interviewed" },
  { value: "WAITLISTED", label: "Waitlisted" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "MATRICULATING", label: "Matriculating" },
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number]["value"];
export const RESULT_STATUS_LABEL: Record<string, string> = Object.fromEntries(RESULT_STATUSES.map((s) => [s.value, s.label]));

// Cycles are named by the year the student would start medical school.
export function cycleOptions(now = new Date()) {
  const y = now.getFullYear();
  return [y - 1, y, y + 1, y + 2];
}

export const RESULT_NOTE_MAX = 300;
export const RESULTS_PER_STUDENT_MAX = 80;

export type CleanResult = {
  cycle: number;
  school: string;
  status: ResultStatus;
  appliedOn: Date | null;
  interviewOn: Date | null;
  decisionOn: Date | null;
  mentorIds: string[];
  note: string | null;
};

function day(v: unknown): Date | null | "bad" {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "bad";
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(d.getTime()) ? "bad" : d;
}

// Checks one row from the student's form. Returns an error or the clean values.
export function cleanResult(body: any, now = new Date()): { error: string } | CleanResult {
  const cycle = Number(body?.cycle);
  if (!cycleOptions(now).includes(cycle)) return { error: "Pick the cycle (the year you'd start medical school)" };
  const school = normalizeMedicalSchool(body?.school);
  if (!school || school.length > MEDICAL_SCHOOL_MAX) return { error: "Pick a school" };
  const status = RESULT_STATUSES.find((s) => s.value === body?.status)?.value;
  if (!status) return { error: "Pick a status" };
  const dates = [day(body?.appliedOn), day(body?.interviewOn), day(body?.decisionOn)];
  if (dates.includes("bad")) return { error: "Check the dates" };
  const [appliedOn, interviewOn, decisionOn] = dates as (Date | null)[];
  const mentorIds = Array.isArray(body?.mentorIds) ? Array.from(new Set(body.mentorIds.filter((x: unknown) => typeof x === "string" && x.length <= 40))).slice(0, 10) as string[] : [];
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, RESULT_NOTE_MAX) || null : null;
  return { cycle, school, status, appliedOn, interviewOn, decisionOn, mentorIds, note };
}
