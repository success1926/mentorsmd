// Shared by the server (lib/schoolLogos.ts) and the browser
// (components/SchoolLogo.tsx); no server-only imports.

import { BUILTIN_SCHOOL_LOGO_FILES } from "@/lib/builtinSchoolLogos";
import { guessMedicalSchool } from "@/lib/medicalSchools";

// School name -> logo address.
export type LogoMap = Record<string, string>;

// Names match ignoring case, punctuation and extra spaces.
export const logoKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Built-in logos (lib/builtinSchoolLogos.ts), keyed the same way.
let builtin: LogoMap | null = null;
function builtinLogos(): LogoMap {
  if (!builtin) {
    builtin = {};
    for (const [name, file] of Object.entries(BUILTIN_SCHOOL_LOGO_FILES)) builtin[logoKey(name)] = `/images/school-logos/${file}`;
  }
  return builtin;
}

// A school's logo: one added in Admin first, then the built-in one. A short
// or loosely typed name ("Georgetown", "Johns Hopkins") also finds the
// listed school it clearly means. "" when there's none.
export function logoFor(logos: LogoMap | null | undefined, name: string | null | undefined): string {
  if (!name?.trim()) return "";
  const find = (k: string) => logos?.[k] || builtinLogos()[k] || "";
  const key = logoKey(name);
  const exact = find(key);
  if (exact) return exact;
  const listed = guessMedicalSchool(name);
  return listed && logoKey(listed) !== key ? find(logoKey(listed)) : "";
}

// "Boston College" -> "BC", "Duke University School of Medicine" -> "DU",
// "University of Michigan Medical School" -> "UM".
const SKIP = new Set(["of", "the", "and", "at", "for", "in", "&"]);
export function schoolInitials(name: string) {
  const words = name.replace(/[^A-Za-z0-9&\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
