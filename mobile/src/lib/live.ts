import { useCallback, useEffect, useState } from "react";
import { api, SITE } from "./api";
import { initials, type Mentor } from "./sample";

// The real mentors on mentorsmd.com, read from the website's JSON routes
// (app/api/mentors, app/api/mentors/[id]). Signed-in people send their
// token, so a profile answers for them (e.g. mentors who only work with
// students 18 and over); visitors read the same public data.
export { SITE };

const RANKS: Record<string, string> = {
  UNDERGRAD: "Undergraduate Student",
  GAP_YEAR: "Gap Year",
  MS1: "Medical Student – Year 1",
  MS2: "Medical Student – Year 2",
  MS3: "Medical Student – Year 3",
  MS4: "Medical Student – Year 4",
  RESIDENT: "Resident Physician",
};
const BEST: Record<string, string> = {
  TRADITIONAL_MD: "Traditional MD", DO: "DO", MD_PHD: "MD-PhD", NONTRADITIONAL: "Nontraditional / career changers", REAPPLICANT: "Reapplicants",
  LOW_GPA: "Low GPA / upward trend", INTERNATIONAL: "International", BS_MD: "BS/MD", RESIDENCY: "Residency / ERAS",
};
const ROLE: Record<string, string> = { COMMITTEE: "Admissions committee", INTERVIEWER: "Interviewer", SCREENER: "Application screener" };
const LEVEL: Record<string, string> = { NATIVE: "Native", FLUENT: "Fluent", CONVERSATIONAL: "Conversational" };

const dollars = (cents: number | null | undefined) => Math.round((cents || 0) / 100);

type Card = {
  id: string; name: string; credential: string | null; medicalSchool: string | null; bio: string | null; photoUrl: string | null;
  mentorStage: string | null; bestFor: string[]; specialties: string[]; clientSchools: string[]; avgRating: number | null; reviewCount: number;
  hourlyRateCents: number | null; fromRateCents: number | null;
  // Since the Browse redesign (Nov 2026): what guided match and compare need.
  strongestStages?: string[]; packageServices?: string[]; offerPrices?: number[]; knownFor?: string | null;
  roleTitles?: string[]; languages?: string[]; totalPackages?: number;
};

function fromCard(c: Card): Mentor {
  return {
    id: c.id, name: c.name, init: initials(c.name), photo: c.photoUrl, live: true,
    stage: (c.mentorStage && RANKS[c.mentorStage]) || c.credential || "",
    school: c.medicalSchool || "",
    rate: dollars(c.fromRateCents ?? c.hourlyRateCents),
    rating: c.avgRating, reviews: c.reviewCount,
    specialties: c.specialties || [], svc: [], best: (c.bestFor || []).map((b) => BEST[b] || b), bg: [], roles: [],
    langs: (c.languages || []).join(", "), fun: "", reply: "", clients: c.clientSchools || [], bio: c.bio || "", bundles: [], pkgs: [],
    knownFor: c.knownFor ? [c.knownFor] : [], credential: c.credential || undefined,
    match: {
      best: c.bestFor || [], stages: c.strongestStages || [], packageServices: c.packageServices || [], prices: c.offerPrices || [],
      roleTypes: c.roleTitles || [], languages: c.languages || [], packageCount: c.totalPackages || 0, fromRate: dollars(c.fromRateCents ?? c.hourlyRateCents),
    },
  };
}

export type FilterGroup = { key: string; title: string; multi?: boolean; options: { value: string; label: string }[] };
export type LiveSearch = { mentors: Mentor[]; filters: FilterGroup[]; quickLinks: { label: string; qs: string }[] };

async function getJson(path: string) {
  try {
    return await api<any>(path);
  } catch (e: any) {
    throw new Error(e?.status === 404 ? "This mentor isn’t on MentorsMD right now." : e?.message || "Couldn’t reach mentorsmd.com");
  }
}

// The guided picks (best, service, price) are ranked in the app
// (src/lib/match.ts), like the website, so only the search box goes to the
// server.
export async function searchLive(params: Record<string, string | null>): Promise<LiveSearch> {
  const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  const d = await getJson("/api/mentors" + (qs ? "?" + qs : ""));
  return { mentors: (d.mentors || []).map(fromCard), filters: d.filters || [], quickLinks: d.quickLinks || [] };
}

type Offer = { id: string; kind: string; title: string; description: string | null; minutes: number | null; price: number; rateCents?: number; service?: string | null; hiddenFromStudents?: boolean };
// An offer a student can buy (the website's PublicOffer): price in cents.
export type LiveOffer = { id: string; kind: "HOURLY" | "BUNDLE" | "SPECIALIZED" | string; title: string; description: string | null; minutes: number; price: number; rateCents: number };
export type LiveSeller = { available: boolean; listed: boolean; adultsOnlyForViewer: boolean };
const STAGE: Record<string, string> = { SCHOOL_LIST: "School list", PERSONAL_STATEMENT: "Personal statement", ACTIVITIES: "Activities", SECONDARIES: "Secondaries", INTERVIEW_PREP: "Interview prep", WAITLIST_LETTERS: "Waitlist / update letters" };
const SPEC: Record<string, string> = { SCHOOL_LIST: "School List & Strategy", PERSONAL_STATEMENT: "Personal Statement", ACTIVITIES: "Activities & Experiences", SECONDARIES: "Secondaries", INTERVIEW_PREP: "Interview Prep", WAITLIST_LETTERS: "Waitlist & Update Letters" };
const SVC_SPEC: Record<string, string> = { PERSONAL_STATEMENT: "Personal Statement", SECONDARIES: "Secondaries", ACTIVITIES: "Activities & Experiences", MMI: "Interview Prep", TRADITIONAL_INTERVIEW: "Interview Prep", SCHOOL_LIST: "School List & Strategy", MCAT: "MCAT", REAPPLICANT: "Reapplicants" };
export type LiveReview = { id: string; rating: number; comment: string | null; createdAt: string; author: string; bought: string };

export async function liveProfile(id: string): Promise<{ mentor: Mentor; reviews: LiveReview[]; offers: { hourly: LiveOffer | null; bundles: LiveOffer[]; packages: LiveOffer[] }; seller: LiveSeller }> {
  const d = await getJson("/api/mentors/" + encodeURIComponent(id));
  const s = d.seller;
  const offers = d.offers || {};
  const hours = (o: Offer) => Math.max(1, Math.round((o.minutes || 60) / 60));
  const all: Offer[] = [...(offers.hourly ? [offers.hourly] : []), ...(offers.bundles || []), ...(offers.packages || [])].filter((o: Offer) => !o.hiddenFromStudents);
  const pkgServices: string[] = [...new Set<string>((offers.packages || []).map((o: Offer) => o.service).filter(Boolean))];
  const stages: string[] = s.strongestStages || [];
  const specialties = [...new Set([...stages.map((x) => SPEC[x]), ...pkgServices.map((x) => SVC_SPEC[x])].filter(Boolean))];
  const mentor: Mentor = {
    id: s.id, name: s.name, init: initials(s.name), photo: s.photoUrl, live: true,
    stage: (s.mentorStage && RANKS[s.mentorStage]) || s.credential || "",
    school: (["UNDERGRAD", "GAP_YEAR", "OTHER"].includes(s.mentorStage) ? s.undergradSchool : s.medicalSchool) || s.medicalSchool || "",
    rate: dollars(offers.hourly?.rateCents ?? s.hourlyRateCents),
    rating: null, reviews: (d.reviews || []).length,
    specialties, svc: [], best: (s.bestFor || []).map((b: string) => BEST[b] || b), bg: [],
    roles: (s.admissionsRoles || []).map((r: any) => [`${ROLE[r.type] || r.type}${r.former ? " (former)" : ""}`, r.place, r.years].filter(Boolean).join(" · ")),
    langs: (s.languages || []).map((l: any) => `${l.name}${l.level ? ` (${LEVEL[l.level] || l.level})` : ""}`).join(", "),
    fun: s.funFact || "", reply: "", clients: s.clientSchools || [], bio: s.bio || "",
    bundles: (offers.bundles || []).map((o: Offer) => [hours(o), dollars(o.price)] as [number, number]),
    pkgs: (offers.packages || []).map((o: Offer) => [o.title, o.description || `${hours(o)} hours`, dollars(o.price)] as [string, string, number]),
    highlights: s.highlights || [], knownFor: s.knownFor || [],
    credential: s.credential || undefined, specialtyInterest: s.specialtyInterest || undefined, research: s.researchSummary || undefined,
    stagesLabel: stages.map((x) => STAGE[x]).filter(Boolean).join(", ") || undefined,
    match: {
      best: s.bestFor || [], stages, packageServices: pkgServices, prices: all.map((o) => o.price).filter((p) => p > 0),
      roleTypes: (s.admissionsRoles || []).map((r: any) => r.type), languages: (s.languages || []).map((l: any) => l.name),
      packageCount: (offers.packages || []).length, fromRate: dollars(all.length ? Math.min(...all.map((o) => o.rateCents || s.hourlyRateCents || 0)) : s.hourlyRateCents),
    },
  };
  const reviews: LiveReview[] = d.reviews || [];
  if (reviews.length) mentor.rating = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  const buyable = (o: Offer): LiveOffer | null =>
    o && !o.hiddenFromStudents && o.price > 0 ? { id: o.id, kind: o.kind, title: o.title, description: o.description, minutes: o.minutes || 60, price: o.price, rateCents: o.rateCents || 0 } : null;
  const list = (xs: Offer[] | undefined) => (xs || []).map(buyable).filter(Boolean) as LiveOffer[];
  return {
    mentor,
    reviews,
    offers: { hourly: offers.hourly ? buyable(offers.hourly) : null, bundles: list(offers.bundles), packages: list(offers.packages) },
    seller: { available: s.available !== false, listed: s.listed !== false, adultsOnlyForViewer: !!s.adultsOnlyForViewer },
  };
}

// Loads something once (and again on refresh), with loading and error states.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    run().then(setData, (e) => setError(e?.message || "Couldn’t reach mentorsmd.com")).finally(() => setLoading(false));
  }, [run]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load };
}
