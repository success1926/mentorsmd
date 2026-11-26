import { useSyncExternalStore } from "react";
import type { Mentor } from "./live";

// Guided match and compare, the same rules as the website's Browse page
// (lib/guidedMatch.ts and components/Compare.tsx in the website code).
// Within a group any pick counts; a mentor fully matches when they meet
// every group the student used. Partial matches are still shown.

export type GuidedKey = "best" | "service" | "price";
export type Picks = Record<GuidedKey, string[]>;
export const emptyPicks = (): Picks => ({ best: [], service: [], price: [] });
export const pickCount = (p: Picks) => p.best.length + p.service.length + p.price.length;

export const BEST_OPTIONS = [
  ["TRADITIONAL_MD", "Traditional MD"], ["DO", "DO"], ["MD_PHD", "MD-PhD"], ["NONTRADITIONAL", "Nontraditional / career changers"], ["REAPPLICANT", "Reapplicants"],
  ["LOW_GPA", "Low GPA / upward trend"], ["INTERNATIONAL", "International"], ["BS_MD", "BS/MD"], ["RESIDENCY", "Residency / ERAS"],
] as const;
export const SERVICE_OPTIONS = [
  ["PERSONAL_STATEMENT", "Personal statement"], ["SECONDARIES", "Secondaries"], ["ACTIVITIES", "Activities & experiences"], ["MMI", "MMI prep"],
  ["TRADITIONAL_INTERVIEW", "Traditional interview prep"], ["SCHOOL_LIST", "School list & strategy"], ["MCAT", "MCAT tutoring"], ["REAPPLICANT", "Reapplicant review"],
] as const;
// Prices in cents; max is exclusive (same bands as the website).
export const PRICE_BANDS = [
  ["50-100", "$50 to $100", 5000, 10001], ["100-250", "$100 to $250", 10001, 25001], ["250-500", "$250 to $500", 25001, 50001], ["500p", "$500 and up", 50001, null],
] as const;

export const GROUPS: { key: GuidedKey; title: string; short: string; options: readonly (readonly [string, string, ...unknown[]])[] }[] = [
  { key: "best", title: "You're applying as", short: "who you are", options: BEST_OPTIONS },
  { key: "service", title: "You need help with", short: "what you need", options: SERVICE_OPTIONS },
  { key: "price", title: "Your budget", short: "budget", options: PRICE_BANDS },
];

export const labelOf = (key: GuidedKey, value: string) => GROUPS.find((g) => g.key === key)?.options.find((o) => o[0] === value)?.[1] || value;
export const BEST_LABEL: Record<string, string> = Object.fromEntries(BEST_OPTIONS);
export const BEST_CODE: Record<string, string> = Object.fromEntries(BEST_OPTIONS.map(([v, l]) => [l, v]));

// A service matches a specialized package of that service, or one of the
// mentor's strongest stages.
const SERVICE_TO_STAGE: Record<string, string> = {
  PERSONAL_STATEMENT: "PERSONAL_STATEMENT", SECONDARIES: "SECONDARIES", ACTIVITIES: "ACTIVITIES", SCHOOL_LIST: "SCHOOL_LIST", MMI: "INTERVIEW_PREP", TRADITIONAL_INTERVIEW: "INTERVIEW_PREP",
};
export function hasService(m: Mentor, service: string) {
  if (m.match.packageServices.includes(service)) return true;
  const st = SERVICE_TO_STAGE[service];
  return !!st && m.match.stages.includes(st);
}
function inBand(m: Mentor, band: string) {
  const b = PRICE_BANDS.find((x) => x[0] === band);
  if (!b) return false;
  return m.match.prices.some((p) => p >= b[2] && (b[3] === null || p < b[3]));
}
export function optionHit(m: Mentor, key: GuidedKey, value: string) {
  if (key === "best") return m.match.best.includes(value);
  if (key === "service") return hasService(m, value);
  return inBand(m, value);
}

export type GroupResult = { key: GuidedKey; short: string; hit: boolean; matched: string[] };
export type MatchResult = { groups: GroupResult[]; hit: number; total: number; full: boolean; optionHits: number };
export function matchMentor(m: Mentor, picks: Picks): MatchResult {
  const groups: GroupResult[] = [];
  let optionHits = 0;
  for (const g of GROUPS) {
    const chosen = picks[g.key];
    if (!chosen.length) continue;
    const matched = chosen.filter((v) => optionHit(m, g.key, v));
    optionHits += matched.length;
    groups.push({ key: g.key, short: g.short, hit: matched.length > 0, matched });
  }
  const hit = groups.filter((g) => g.hit).length;
  return { groups, hit, total: groups.length, full: hit === groups.length, optionHits };
}

export function rank(mentors: Mentor[], picks: Picks, sort: string) {
  const scored = mentors.map((m) => ({ m, r: matchMentor(m, picks) }));
  const score = (m: Mentor) => (m.rating ?? 0) * Math.log2(2 + m.reviews);
  scored.sort((a, b) => {
    if (sort === "low") return a.m.rate - b.m.rate;
    if (sort === "high") return b.m.rate - a.m.rate;
    if (sort === "rated") return (b.m.rating ?? 0) - (a.m.rating ?? 0) || b.m.reviews - a.m.reviews;
    return b.r.hit - a.r.hit || b.r.optionHits - a.r.optionHits || score(b.m) - score(a.m);
  });
  const n = pickCount(picks);
  return {
    full: n ? scored.filter((x) => x.r.full) : scored,
    partial: n ? scored.filter((x) => !x.r.full && x.r.hit > 0) : [],
    hidden: n ? scored.filter((x) => x.r.hit === 0).length : 0,
  };
}

// ---- compare: up to three mentors, kept while the app is open ----
export const COMPARE_MAX = 3;
let picked: Mentor[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snap = () => picked;

export function useCompare() {
  const items = useSyncExternalStore(subscribe, snap, snap);
  return {
    items,
    has: (id: string) => items.some((m) => m.id === id),
    full: items.length >= COMPARE_MAX,
    toggle(m: Mentor) {
      picked = picked.some((x) => x.id === m.id) ? picked.filter((x) => x.id !== m.id) : picked.length < COMPARE_MAX ? [...picked, m] : picked;
      emit();
    },
    // A fuller copy (from the profile) replaces the one from the list.
    refresh(m: Mentor) {
      if (picked.some((x) => x.id === m.id)) {
        picked = picked.map((x) => (x.id === m.id ? { ...x, ...m, match: { ...x.match, ...m.match } } : x));
        emit();
      }
    },
    remove(id: string) {
      picked = picked.filter((x) => x.id !== id);
      emit();
    },
    clear() {
      picked = [];
      emit();
    },
  };
}
