// Checks the mentor profile sections sent by the Account page
// (PATCH /api/profile). Every field is optional in one request (sections
// are saved on their own), but each one sent must be valid. Saving an
// unfinished section is allowed: the checklist (lib/profileCompleteness.ts)
// says what's still missing, and the mentor stays hidden until it's done.
import { ADMISSIONS_ROLE_TYPES, BEST_FOR, LANGUAGE_LEVELS, PROFILE_RULES as R, STRONGEST_STAGES, isValue } from "@/lib/options";
import type { AdmissionsRole, Language } from "@/lib/profileCompleteness";

type Data = {
  admissionsRoles?: AdmissionsRole[];
  yearsAdvising?: number | null;
  applicantsSupported?: number | null;
  strongestStages?: string[];
  specialtyInterest?: string | null;
  researchSummary?: string | null;
  bestFor?: string[];
  bestForOther?: string | null;
  highlights?: string[];
  knownFor?: string[];
  languages?: Language[];
  funFact?: string | null;
};

// One line of text: trimmed, inner whitespace collapsed.
const line = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
// A paragraph: trimmed, line breaks kept.
const para = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function intOrNull(v: unknown, max: number): number | null | "bad" {
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : "bad";
}

function bullets(v: unknown, max: number, maxLen: number): string[] | string {
  if (!Array.isArray(v)) return "must be a list";
  const out = v.map(line).filter(Boolean);
  if (out.length > max) return `can have at most ${max} bullets`;
  if (out.some((b) => b.length > maxLen)) return `bullets can be up to ${maxLen} characters`;
  return out;
}

function pickList(v: unknown, list: { value: string }[]): string[] | null {
  if (!Array.isArray(v) || !v.every((x) => isValue(list as any, x))) return null;
  return Array.from(new Set(v as string[]));
}

export function parseMentorProfile(body: any): { data: Data } | { error: string } {
  const data: Data = {};

  if (body.admissionsRoles !== undefined) {
    if (!Array.isArray(body.admissionsRoles) || body.admissionsRoles.length > R.rolesMax) return { error: `Add up to ${R.rolesMax} admissions roles` };
    const roles: AdmissionsRole[] = [];
    for (const r of body.admissionsRoles) {
      if (!r || typeof r !== "object" || !isValue(ADMISSIONS_ROLE_TYPES, r.type)) return { error: "Pick the type of each admissions role" };
      const place = line(r.place);
      const years = line(r.years);
      if (place.length > R.shortMax || years.length > 40) return { error: "An admissions role is too long" };
      if (!years) return { error: "Add the years for each admissions role, e.g. 2022 to 2024" };
      roles.push({ type: r.type, place, years, former: r.former === true });
    }
    data.admissionsRoles = roles;
  }
  if (body.yearsAdvising !== undefined) {
    const n = intOrNull(body.yearsAdvising, 60);
    if (n === "bad") return { error: "Years advising must be a whole number" };
    data.yearsAdvising = n;
  }
  if (body.applicantsSupported !== undefined) {
    const n = intOrNull(body.applicantsSupported, 100000);
    if (n === "bad") return { error: "Applicants supported must be a whole number" };
    data.applicantsSupported = n;
  }
  if (body.strongestStages !== undefined) {
    const v = pickList(body.strongestStages, STRONGEST_STAGES);
    if (!v) return { error: "Unknown application stage" };
    data.strongestStages = v;
  }
  if (body.specialtyInterest !== undefined) {
    const v = line(body.specialtyInterest);
    if (v.length > R.shortMax) return { error: `Specialty interest can be up to ${R.shortMax} characters` };
    data.specialtyInterest = v || null;
  }
  if (body.researchSummary !== undefined) {
    const v = para(body.researchSummary);
    if (v.length > R.textMax) return { error: `Research can be up to ${R.textMax} characters` };
    data.researchSummary = v || null;
  }
  if (body.bestFor !== undefined) {
    const v = pickList(body.bestFor, BEST_FOR);
    if (!v) return { error: "Unknown \"best for\" option" };
    data.bestFor = v;
  }
  if (body.bestForOther !== undefined) {
    const v = line(body.bestForOther);
    if (v.length > 60) return { error: "\"Other\" can be up to 60 characters" };
    data.bestForOther = v || null;
  }
  if (body.highlights !== undefined) {
    const v = bullets(body.highlights, R.highlightsMax, R.shortMax);
    if (typeof v === "string") return { error: `Credentials & highlights ${v}` };
    data.highlights = v;
  }
  if (body.knownFor !== undefined) {
    const v = bullets(body.knownFor, R.knownForCount, R.knownForMax);
    if (typeof v === "string") return { error: `"Known for" ${v}` };
    data.knownFor = v;
  }
  if (body.languages !== undefined) {
    if (!Array.isArray(body.languages) || body.languages.length > R.languagesMax) return { error: `Add up to ${R.languagesMax} languages` };
    const langs: Language[] = [];
    for (const l of body.languages) {
      const name = line(l?.name);
      if (!name) continue;
      if (name.length > 40) return { error: "A language name is too long" };
      if (!isValue(LANGUAGE_LEVELS, l.level)) return { error: `Pick how well you speak ${name}` };
      if (langs.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is listed twice` };
      langs.push({ name, level: l.level, canAdvise: l.canAdvise === true });
    }
    data.languages = langs;
  }
  if (body.funFact !== undefined) {
    const v = para(body.funFact);
    if (v.length > R.funFactMax) return { error: `The fun fact can be up to ${R.funFactMax} characters` };
    data.funFact = v || null;
  }
  return { data };
}
