// The fixed answer lists behind the browse filters and the package form.
// Safe to import from both server and client code (no server-only imports).
// Changing a label here is safe; changing a `value` needs a data update,
// because packages store the value.

export type Option = { value: string; label: string };

export const SERVICES: Option[] = [
  { value: "PERSONAL_STATEMENT", label: "Personal statement" },
  { value: "SECONDARIES", label: "Secondaries" },
  { value: "ACTIVITIES", label: "Activities & experiences" },
  { value: "MMI", label: "MMI prep" },
  { value: "TRADITIONAL_INTERVIEW", label: "Traditional interview prep" },
  { value: "SCHOOL_LIST", label: "School list & strategy" },
  { value: "MCAT", label: "MCAT tutoring" },
  { value: "REAPPLICANT", label: "Reapplicant review" },
  // "Other" packages carry their own short service name (Gig.serviceOther),
  // which is shown everywhere in place of the word "Other".
  { value: "OTHER", label: "Other" },
];

export const SERVICE_OTHER_MIN = 3;
export const SERVICE_OTHER_MAX = 40;

// The service name to show for a package: its custom name for "Other".
export function serviceLabel(service: string | null | undefined, serviceOther?: string | null) {
  if (service === "OTHER") return serviceOther?.trim() || "Other";
  return labelFor(SERVICES, service);
}

// How an offer is delivered. The stored values predate the Oct 2026
// redesign (WRITTEN_CALL was "written feedback + call", LIVE was "live
// video session"), so old packages and orders keep a sensible label.
export const FORMATS: Option[] = [
  { value: "LIVE", label: "Calls only" },
  { value: "WRITTEN", label: "Written only" },
  { value: "WRITTEN_CALL", label: "Calls + written" },
];

export const TURNAROUNDS: Option[] = [
  { value: "H48", label: "48 hours or less" },
  { value: "D3_5", label: "3 to 5 days" },
  { value: "W1_2", label: "1 to 2 weeks" },
  { value: "SCHEDULED", label: "Scheduled call" },
];

export const STAGES: Option[] = [
  { value: "MS1", label: "MS1" },
  { value: "MS2", label: "MS2" },
  { value: "MS3", label: "MS3" },
  { value: "MS4", label: "MS4" },
  { value: "RESIDENT", label: "Resident" },
];

export const SCHOOL_TYPES: Option[] = [
  { value: "MD", label: "MD" },
  { value: "DO", label: "DO" },
  { value: "MD_PHD", label: "MD/PhD" },
];

// No longer used since the Oct 2026 redesign ("Who you're best for",
// BEST_FOR below, replaced it everywhere). Kept only to label old data.
export const BACKGROUNDS: Option[] = [
  { value: "REAPPLICANT", label: "Reapplicant" },
  { value: "NON_TRADITIONAL", label: "Non-traditional" },
  { value: "FIRST_GEN", label: "First-generation" },
  { value: "GAP_YEARS", label: "Gap years" },
  { value: "CAREER_CHANGER", label: "Career changer" },
];

// ---- Mentor profile sections (redesign Oct 2026) ----
// "Who you're best for": the students a mentor helps most. Also a browse
// filter (?best=...). Changing a value needs a data update.
export const BEST_FOR: Option[] = [
  { value: "TRADITIONAL_MD", label: "Traditional MD" },
  { value: "DO", label: "DO" },
  { value: "MD_PHD", label: "MD-PhD" },
  { value: "NONTRADITIONAL", label: "Nontraditional / career changers" },
  { value: "REAPPLICANT", label: "Reapplicants" },
  { value: "LOW_GPA", label: "Low GPA / upward trend" },
  { value: "INTERNATIONAL", label: "International" },
  { value: "BS_MD", label: "BS/MD" },
  { value: "RESIDENCY", label: "Residency / ERAS" },
];

// The application stages a mentor is strongest at.
export const STRONGEST_STAGES: Option[] = [
  { value: "SCHOOL_LIST", label: "School list" },
  { value: "PERSONAL_STATEMENT", label: "Personal statement" },
  { value: "ACTIVITIES", label: "Activities" },
  { value: "SECONDARIES", label: "Secondaries" },
  { value: "INTERVIEW_PREP", label: "Interview prep" },
  { value: "WAITLIST_LETTERS", label: "Waitlist / update letters" },
];

// Browse "Service" filter: a mentor also matches a service when it's one
// of their strongest stages (so hourly-only mentors can be found too).
export const SERVICE_TO_STAGE: Record<string, string> = {
  PERSONAL_STATEMENT: "PERSONAL_STATEMENT",
  SECONDARIES: "SECONDARIES",
  ACTIVITIES: "ACTIVITIES",
  SCHOOL_LIST: "SCHOOL_LIST",
  MMI: "INTERVIEW_PREP",
  TRADITIONAL_INTERVIEW: "INTERVIEW_PREP",
};

export const ADMISSIONS_ROLE_TYPES: Option[] = [
  { value: "COMMITTEE", label: "Admissions committee" },
  { value: "INTERVIEWER", label: "Interviewer" },
  { value: "SCREENER", label: "Application screener" },
];

export const LANGUAGE_LEVELS: Option[] = [
  { value: "NATIVE", label: "Native" },
  { value: "FLUENT", label: "Fluent" },
  { value: "CONVERSATIONAL", label: "Conversational" },
];

// Lengths for the profile sections. Words are counted with countWords().
export const PROFILE_RULES = {
  bioMinWords: 40,
  researchMinWords: 20,
  textMax: 1500, // research, fun fact
  shortMax: 120, // a highlight, a role's place/years, specialty
  knownForMax: 80, // each "Known for" bullet
  highlightsMin: 4,
  highlightsMax: 6,
  knownForCount: 3,
  rolesMax: 8,
  languagesMax: 8,
  funFactMax: 300,
};

// ---- Hourly pricing (redesign Oct 2026) ----
// One hourly rate per mentor, whole dollars. Every offer's price is
// hours x rate (lib/pricing.ts).
export const RATE_MIN_CENTS = 5_000; // $50 an hour
export const RATE_MAX_CENTS = 100_000; // $1,000 an hour
export const RATE_RULE = "Rates are whole dollars, at least $50 an hour (up to $1,000)";
// Hour bundles: whole hours. Specialized packages: estimated hours in
// half-hour steps.
export const BUNDLE_HOURS = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
export const PACKAGE_MIN_MINUTES = 60;
export const PACKAGE_MAX_MINUTES = 40 * 60;
export const MAX_BUNDLES = 6;
export const MAX_SPECIALIZED = 12;
export const INTRO_CALL_MINUTES = 15;

// Old per-package price limits, in cents (before the redesign: packages
// had a typed-in price). Still used by the old checkout until part 2. Enforced on the package form, the
// package API and checkout. Packages outside this range (made before the
// limits changed) are hidden from search until the mentor updates them.
export const PRICE_MIN_CENTS = 5_000; // $50
export const PRICE_MAX_CENTS = 500_000; // $5,000
export const PRICE_RULE = "Price must be between $50 and $5,000";

export function isPriceInRange(cents: number) {
  return cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS;
}

// Price bands for the browse filter, in cents. max is exclusive. Matched
// against every offer's computed price (an hour, a bundle or a package).
export const PRICE_BANDS: { value: string; label: string; min: number; max: number | null }[] = [
  { value: "50-100", label: "$50 to $100", min: 5000, max: 10001 },
  { value: "100-250", label: "$100 to $250", min: 10001, max: 25001 },
  { value: "250-500", label: "$250 to $500", min: 25001, max: 50001 },
  { value: "500p", label: "$500 and up", min: 50001, max: null },
];

export const RATINGS: Option[] = [
  { value: "4.5", label: "4.5 stars and up" },
  { value: "4", label: "4 stars and up" },
];

export const CALL_LENGTHS = [30, 45, 60];
export const MAX_CALLS = 3;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Minimum length for a package description, in words.
export const GIG_DESCRIPTION_MIN_WORDS = 30;

export function labelFor(list: Option[], value: string | null | undefined) {
  if (!value) return "";
  return list.find((o) => o.value === value)?.label ?? value;
}

export function isValue(list: Option[], value: unknown): value is string {
  return typeof value === "string" && list.some((o) => o.value === value);
}

// Formats that include a call with the mentor.
export function formatHasCall(format: string | null | undefined) {
  return format === "WRITTEN_CALL" || format === "LIVE";
}

// Keeps the old category column meaningful for anything that still reads it.
export function categoryForService(service: string) {
  switch (service) {
    case "PERSONAL_STATEMENT":
    case "SECONDARIES":
    case "ACTIVITIES":
      return "ESSAY_REVIEW" as const;
    case "MMI":
    case "TRADITIONAL_INTERVIEW":
      return "MOCK_INTERVIEW" as const;
    case "SCHOOL_LIST":
    case "REAPPLICANT":
      return "APPLICATION_STRATEGY" as const;
    case "MCAT":
      return "TUTORING" as const;
    default:
      return "OTHER" as const;
  }
}

export function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// The browse sidebar groups, in order. Lives here (not in the client
// component) so the server-rendered browse page can use it too.
export const FILTER_GROUPS = [
  { key: "service", title: "Service", sub: "What you need help with", options: SERVICES, multi: true },
  { key: "format", title: "Format", sub: "How the help is delivered", options: FORMATS, multi: true },
  { key: "price", title: "Price", sub: "An hour, a bundle or a package", options: PRICE_BANDS.map(({ value, label }) => ({ value, label })), multi: true },
  { key: "stage", title: "Mentor stage", sub: "Where they are in training", options: STAGES, multi: true },
  { key: "school", title: "School type", sub: "Where they study or train", options: SCHOOL_TYPES, multi: true },
  { key: "best", title: "Best for", sub: "The students they help most", options: BEST_FOR, multi: true },
  { key: "rating", title: "Rating", sub: "From student reviews", options: RATINGS, multi: false },
];

// Quick links across the top of /mentors, also shown in the top bar once
// the page is scrolled (components/TopNav.tsx). Each sets one filter and
// clears the others.
export const MENTOR_QUICK_LINKS: { label: string; qs: string }[] = [
  { label: "Popular", qs: "" },
  { label: "Personal statement", qs: "service=PERSONAL_STATEMENT" },
  { label: "Secondaries", qs: "service=SECONDARIES" },
  { label: "MMI", qs: "service=MMI" },
  { label: "Traditional interviews", qs: "service=TRADITIONAL_INTERVIEW" },
  { label: "MCAT", qs: "service=MCAT" },
  { label: "School list", qs: "service=SCHOOL_LIST" },
  { label: "Reapplicants", qs: "best=REAPPLICANT" },
  { label: "Nontraditional", qs: "best=NONTRADITIONAL" },
  { label: "DO", qs: "best=DO" },
  { label: "MD-PhD", qs: "best=MD_PHD" },
  { label: "Residency / ERAS", qs: "best=RESIDENCY" },
];

export const quickLinkHref = (q: { qs: string }) => (q.qs ? `/mentors?${q.qs}` : "/mentors");
