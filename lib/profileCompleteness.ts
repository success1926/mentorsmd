// "Finish your profile": the 10 sections a mentor must fill in before they
// show on Browse mentors / search / the homepage and can be bought from
// (docs/redesign-2026-10.md section 2). Pure functions, safe to import from
// both server and client code. The server keeps User.profileCompleteAt in
// step with this (lib/profileSync.ts), so browse can filter on it.
import type { Prisma } from "@prisma/client";
import { BEST_FOR, PROFILE_RULES as R, RATE_MIN_CENTS, STRONGEST_STAGES, countWords, isValue } from "@/lib/options";

export type AdmissionsRole = { type: string; place: string; years: string; former: boolean };
export type Language = { name: string; level: string; canAdvise: boolean };

export type ProfileFields = {
  photoUrl: string | null;
  credential: string | null;
  medicalSchool: string | null;
  mentorStage: string | null;
  schoolType: string | null;
  bio: string | null;
  admissionsRoles: unknown;
  yearsAdvising: number | null;
  applicantsSupported: number | null;
  strongestStages: string[];
  specialtyInterest: string | null;
  researchSummary: string | null;
  bestFor: string[];
  highlights: string[];
  knownFor: string[];
  languages: unknown;
  funFact: string | null;
  hourlyRateCents: number | null;
};

// The fields to load for the checklist (a Prisma select).
export const profileFieldsSelect = {
  photoUrl: true,
  credential: true,
  medicalSchool: true,
  mentorStage: true,
  schoolType: true,
  bio: true,
  admissionsRoles: true,
  yearsAdvising: true,
  applicantsSupported: true,
  strongestStages: true,
  specialtyInterest: true,
  researchSummary: true,
  bestFor: true,
  highlights: true,
  knownFor: true,
  languages: true,
  funFact: true,
  hourlyRateCents: true,
} as const;

// Mentors who finished every section (add to any "listed mentors" query).
export const completeProfileWhere: Prisma.UserWhereInput = { profileCompleteAt: { not: null } };

export function rolesOf(value: unknown): AdmissionsRole[] {
  return Array.isArray(value) ? (value as AdmissionsRole[]).filter((r) => r && typeof r === "object" && typeof r.type === "string") : [];
}

export function languagesOf(value: unknown): Language[] {
  return Array.isArray(value) ? (value as Language[]).filter((l) => l && typeof l === "object" && typeof l.name === "string" && l.name.trim()) : [];
}

const filled = (s: string | null | undefined) => !!s && s.trim().length > 0;

export type ProfileSection = {
  key: string;
  label: string;
  done: boolean;
  hint: string; // what's still missing, in plain words
  href: string; // where to fix it
};

export function profileSections(u: ProfileFields): ProfileSection[] {
  const roles = rolesOf(u.admissionsRoles);
  const langs = languagesOf(u.languages);
  const bioWords = countWords(u.bio || "");
  const researchWords = countWords(u.researchSummary || "");
  const highlights = (u.highlights || []).filter(filled);
  const knownFor = (u.knownFor || []).filter(filled);
  const stages = (u.strongestStages || []).filter((s) => isValue(STRONGEST_STAGES, s));
  const bestFor = (u.bestFor || []).filter((s) => isValue(BEST_FOR, s));

  const basicsMissing = [
    !u.photoUrl && "photo",
    !filled(u.credential) && "one-line credential",
    !filled(u.medicalSchool) && "medical school",
    !u.mentorStage && "stage",
    !u.schoolType && "school type",
  ].filter(Boolean) as string[];
  const admissionsMissing = [
    roles.length === 0 && "at least one role",
    u.yearsAdvising === null || u.yearsAdvising === undefined ? "years advising" : false,
    u.applicantsSupported === null || u.applicantsSupported === undefined ? "applicants supported" : false,
    stages.length === 0 && "strongest stages",
  ].filter(Boolean) as string[];
  const clinicalMissing = [
    !filled(u.specialtyInterest) && "specialty interest",
    researchWords < R.researchMinWords && `research (${researchWords} of ${R.researchMinWords} words)`,
  ].filter(Boolean) as string[];

  return [
    { key: "basics", label: "Photo, credential and school", done: basicsMissing.length === 0, hint: basicsMissing.length ? `Add your ${basicsMissing.join(", ")}` : "", href: "/account#profile" },
    { key: "bio", label: "Bio", done: bioWords >= R.bioMinWords, hint: `${bioWords} of ${R.bioMinWords} words`, href: "/account#bio" },
    { key: "admissions", label: "Admissions experience", done: admissionsMissing.length === 0, hint: admissionsMissing.length ? `Add ${admissionsMissing.join(", ")}` : "", href: "/account#admissions" },
    { key: "clinical", label: "Clinical & research", done: clinicalMissing.length === 0, hint: clinicalMissing.length ? `Add ${clinicalMissing.join(", ")}` : "", href: "/account#clinical" },
    { key: "bestFor", label: "Who you're best for", done: bestFor.length > 0, hint: "Pick at least one", href: "/account#best-for" },
    { key: "highlights", label: "Credentials & highlights", done: highlights.length >= R.highlightsMin && highlights.length <= R.highlightsMax, hint: `${highlights.length} of ${R.highlightsMin} to ${R.highlightsMax} bullets`, href: "/account#highlights" },
    { key: "knownFor", label: "Known for", done: knownFor.length === R.knownForCount, hint: `${knownFor.length} of ${R.knownForCount} bullets`, href: "/account#known-for" },
    { key: "languages", label: "Languages", done: langs.length > 0, hint: "Add at least one language", href: "/account#languages" },
    { key: "funFact", label: "Fun fact", done: filled(u.funFact), hint: "Add one or two sentences", href: "/account#fun-fact" },
    { key: "rate", label: "Hourly rate", done: (u.hourlyRateCents ?? 0) >= RATE_MIN_CENTS, hint: "Set your hourly rate (at least $50)", href: "/dashboard/packages#rate" },
  ];
}

export function profileProgress(u: ProfileFields) {
  const sections = profileSections(u);
  const done = sections.filter((s) => s.done).length;
  return { sections, done, total: sections.length, complete: done === sections.length };
}

export function isProfileComplete(u: ProfileFields) {
  return profileProgress(u).complete;
}
