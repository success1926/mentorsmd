import { useCallback, useEffect, useState } from "react";
import { initials, type Mentor } from "./sample";

// The real mentors on mentorsmd.com, read from the public JSON routes the
// website already has (app/api/mentors, app/api/mentors/[id]). Reading only:
// nothing in the app writes to the live site.
export const SITE = (process.env.EXPO_PUBLIC_SITE_URL || "https://www.mentorsmd.com").replace(/\/$/, "");

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
};

function fromCard(c: Card): Mentor {
  return {
    id: c.id, name: c.name, init: initials(c.name), photo: c.photoUrl, live: true,
    stage: (c.mentorStage && RANKS[c.mentorStage]) || c.credential || "",
    school: c.medicalSchool || "",
    rate: dollars(c.fromRateCents ?? c.hourlyRateCents),
    rating: c.avgRating, reviews: c.reviewCount,
    specialties: c.specialties || [], svc: [], best: (c.bestFor || []).map((b) => BEST[b] || b), bg: [], roles: [],
    langs: "", fun: "", reply: "", clients: c.clientSchools || [], bio: c.bio || "", bundles: [], pkgs: [],
  };
}

export type FilterGroup = { key: string; title: string; multi?: boolean; options: { value: string; label: string }[] };
export type LiveSearch = { mentors: Mentor[]; filters: FilterGroup[]; quickLinks: { label: string; qs: string }[] };

async function getJson(path: string) {
  const r = await fetch(SITE + path, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(r.status === 404 ? "Not found" : `mentorsmd.com answered ${r.status}`);
  return r.json();
}

export async function searchLive(params: Record<string, string | null>): Promise<LiveSearch> {
  const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join("&");
  const d = await getJson("/api/mentors" + (qs ? "?" + qs : ""));
  return { mentors: (d.mentors || []).map(fromCard), filters: d.filters || [], quickLinks: d.quickLinks || [] };
}

type Offer = { id: string; kind: string; title: string; description: string | null; minutes: number | null; price: number };
export type LiveReview = { id: string; rating: number; comment: string | null; createdAt: string; author: string; bought: string };

export async function liveProfile(id: string): Promise<{ mentor: Mentor; reviews: LiveReview[] }> {
  const d = await getJson("/api/mentors/" + encodeURIComponent(id));
  const s = d.seller;
  const offers = d.offers || {};
  const hours = (o: Offer) => Math.max(1, Math.round((o.minutes || 60) / 60));
  const mentor: Mentor = {
    id: s.id, name: s.name, init: initials(s.name), photo: s.photoUrl, live: true,
    stage: (s.mentorStage && RANKS[s.mentorStage]) || s.credential || "",
    school: (["UNDERGRAD", "GAP_YEAR", "OTHER"].includes(s.mentorStage) ? s.undergradSchool : s.medicalSchool) || s.medicalSchool || "",
    rate: dollars(s.hourlyRateCents),
    rating: null, reviews: (d.reviews || []).length,
    specialties: [], svc: [], best: (s.bestFor || []).map((b: string) => BEST[b] || b), bg: [],
    roles: (s.admissionsRoles || []).map((r: any) => [ROLE[r.type] || r.type, r.place].filter(Boolean).join(" · ")),
    langs: (s.languages || []).map((l: any) => `${l.name}${l.level ? ` (${LEVEL[l.level] || l.level})` : ""}`).join(", "),
    fun: s.funFact || "", reply: "", clients: s.clientSchools || [], bio: s.bio || "",
    bundles: (offers.bundles || []).map((o: Offer) => [hours(o), dollars(o.price)] as [number, number]),
    pkgs: (offers.packages || []).map((o: Offer) => [o.title, o.description || `${hours(o)} hours`, dollars(o.price)] as [string, string, number]),
    highlights: s.highlights || [], knownFor: s.knownFor || [],
  };
  const reviews: LiveReview[] = d.reviews || [];
  if (reviews.length) mentor.rating = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
  return { mentor, reviews };
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
