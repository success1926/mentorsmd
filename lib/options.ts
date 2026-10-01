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
];

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

// Price bands for the browse filter, in cents. max is exclusive.
// (Open question: final bands - see the open-questions doc.)
export const PRICE_BANDS: { value: string; label: string; min: number; max: number | null }[] = [
  { value: "u50", label: "Under $50", min: 0, max: 5000 },
  { value: "50-100", label: "$50 to $100", min: 5000, max: 10000 },
  { value: "100-200", label: "$100 to $200", min: 10000, max: 20000 },
  { value: "200p", label: "$200 and up", min: 20000, max: null },
];

export const RATINGS: Option[] = [
  { value: "4.5", label: "4.5 stars and up" },
  { value: "4", label: "4 stars and up" },
];

export const CALL_LENGTHS = [30, 45, 60];
export const MAX_CALLS = 3;

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
