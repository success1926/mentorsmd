import { BEST_FOR, PRICE_BANDS, SERVICE_TO_STAGE, SERVICES, labelFor } from "@/lib/options";

// Guided match on Browse (Nov 2026). The student picks any options in three
// groups (who they are, what they need, budget). Within a group any pick
// counts (OR); a mentor "fully matches" when they meet every group the
// student used. Partial matches are still shown, under "Also worth a look",
// with what they're missing. Pure functions: used by the browse page on the
// server (search log count) and in the browser (live ranking).

export type GuidedKey = "best" | "service" | "price";
export type Picks = Record<GuidedKey, string[]>;

// What a mentor needs for matching (part of MentorCardData).
export type MatchableMentor = {
  bestFor: string[];
  strongestStages: string[];
  packageServices: string[];
  offerPrices: number[]; // every offer's price, in cents
};

export const GUIDED_GROUPS: { key: GuidedKey; title: string; short: string; sub: string; options: { value: string; label: string }[] }[] = [
  { key: "best", title: "You're applying as", short: "who you are", sub: "Pick any", options: BEST_FOR },
  { key: "service", title: "You need help with", short: "what you need", sub: "Pick any", options: SERVICES.filter((o) => o.value !== "OTHER") },
  { key: "price", title: "Your budget", short: "budget", sub: "Any offer in this range", options: PRICE_BANDS.map(({ value, label }) => ({ value, label })) },
];

// The keys are the old filter sidebar's (?best=, ?service=, ?price=), so
// old links and the quick links keep working.

export const emptyPicks = (): Picks => ({ best: [], service: [], price: [] });

export function picksFrom(params: { getAll(key: string): string[] }): Picks {
  const out = emptyPicks();
  for (const g of GUIDED_GROUPS) {
    const allowed = new Set(g.options.map((o) => o.value));
    out[g.key] = Array.from(new Set(params.getAll(g.key).flatMap((v) => v.split(",")).filter((v) => allowed.has(v))));
  }
  return out;
}

export const pickCount = (p: Picks) => p.best.length + p.service.length + p.price.length;

// A service matches a specialized package of that service, or one of the
// mentor's strongest stages (as the old filter did, so hourly-only mentors
// can be found too).
export function hasService(m: MatchableMentor, service: string) {
  if (m.packageServices.includes(service)) return true;
  const stage = SERVICE_TO_STAGE[service];
  return !!stage && m.strongestStages.includes(stage);
}

export function inBand(m: MatchableMentor, band: string) {
  const b = PRICE_BANDS.find((x) => x.value === band);
  if (!b) return false;
  return m.offerPrices.some((p) => p >= b.min && (b.max === null || p < b.max));
}

export function optionHit(m: MatchableMentor, key: GuidedKey, value: string) {
  if (key === "best") return m.bestFor.includes(value);
  if (key === "service") return hasService(m, value);
  return inBand(m, value);
}

export type GroupResult = { key: GuidedKey; short: string; hit: boolean; matched: string[] };
export type MatchResult = { groups: GroupResult[]; hit: number; total: number; full: boolean; optionHits: number };

export function matchMentor(m: MatchableMentor, picks: Picks): MatchResult {
  const groups: GroupResult[] = [];
  let optionHits = 0;
  for (const g of GUIDED_GROUPS) {
    const chosen = picks[g.key];
    if (!chosen.length) continue;
    const matched = chosen.filter((v) => optionHit(m, g.key, v));
    optionHits += matched.length;
    groups.push({ key: g.key, short: g.short, hit: matched.length > 0, matched });
  }
  const hit = groups.filter((g) => g.hit).length;
  return { groups, hit, total: groups.length, full: hit === groups.length, optionHits };
}

// How many mentors each option would match on its own (shown on the pills).
export function optionCount(mentors: MatchableMentor[], key: GuidedKey, value: string) {
  return mentors.filter((m) => optionHit(m, key, value)).length;
}

export function pickLabel(key: GuidedKey, value: string) {
  const g = GUIDED_GROUPS.find((x) => x.key === key);
  return g ? labelFor(g.options, value) : value;
}
