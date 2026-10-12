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

export const FORMATS: Option[] = [
  { value: "WRITTEN", label: "Written feedback" },
  { value: "WRITTEN_CALL", label: "Written feedback + call" },
  { value: "LIVE", label: "Live video session" },
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

export const BACKGROUNDS: Option[] = [
  { value: "REAPPLICANT", label: "Reapplicant" },
  { value: "NON_TRADITIONAL", label: "Non-traditional" },
  { value: "FIRST_GEN", label: "First-generation" },
  { value: "GAP_YEARS", label: "Gap years" },
  { value: "CAREER_CHANGER", label: "Career changer" },
];

// Package price limits, in cents. Enforced on the package form, the
// package API and checkout. Packages outside this range (made before the
// limits changed) are hidden from search until the mentor updates them.
export const PRICE_MIN_CENTS = 5_000; // $50
export const PRICE_MAX_CENTS = 500_000; // $5,000
export const PRICE_RULE = "Price must be between $50 and $5,000";

export function isPriceInRange(cents: number) {
  return cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS;
}

// Price bands for the browse filter, in cents. max is exclusive.
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
  { key: "turnaround", title: "Turnaround", sub: "How fast you get it back", options: TURNAROUNDS, multi: true },
  { key: "price", title: "Price", sub: "Per package", options: PRICE_BANDS.map(({ value, label }) => ({ value, label })), multi: true },
  { key: "stage", title: "Mentor stage", sub: "Where they are in training", options: STAGES, multi: true },
  { key: "school", title: "School type", sub: "Where they study or train", options: SCHOOL_TYPES, multi: true },
  { key: "bg", title: "Been where you are", sub: "Their own path to med school", options: BACKGROUNDS, multi: true },
  { key: "rating", title: "Rating", sub: "From student reviews", options: RATINGS, multi: false },
];
