// Plain values worked out from a mentor's profile data, shared by the
// server-rendered sections (ProfileStatic.tsx) and the interactive parts
// (ProfileClient.tsx), so both always agree. No React, no hooks.
import { BEST_FOR, labelFor, mentorRank, mentorSchoolName, mentorStageTag, specialtiesOf } from "@/lib/options";
import { firstName } from "@/lib/format";
import type { AdmissionsRole, Language } from "@/lib/profileCompleteness";

type OffersLike = { packages: { service: string | null }[] };

export function profileBasics(seller: any, offers: OffersLike, reviews: { rating: number }[]) {
  const first = firstName(seller.name) || seller.name;
  // Count and average over all reviews (from the server); only the newest
  // 50 are listed, so they're the fallback, not the source.
  const reviewCount: number = typeof seller.reviewCount === "number" ? seller.reviewCount : reviews.length;
  const avg: number | null =
    typeof seller.avgRating === "number" ? seller.avgRating : reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const bestFor: string[] = [...(seller.bestFor || []).map((b: string) => labelFor(BEST_FOR, b)), ...(seller.bestForOther ? [seller.bestForOther] : [])];
  const school = mentorSchoolName(seller);
  const rank = mentorRank(seller.mentorStage) || mentorStageTag(seller.mentorStage);
  const clientSchools: string[] = seller.clientSchools || [];
  const specialties = specialtiesOf(seller.strongestStages, offers.packages.map((p) => p.service));
  const roles: AdmissionsRole[] = seller.admissionsRoles || [];
  const highlights: string[] = seller.highlights || [];
  const knownFor: string[] = seller.knownFor || [];
  const languages: Language[] = seller.languages || [];
  // The quick facts under the About heading.
  const facts: { value: string; label: string }[] = [
    ...(typeof seller.yearsAdvising === "number" && seller.yearsAdvising > 0 ? [{ value: `${seller.yearsAdvising}+`, label: seller.yearsAdvising === 1 ? "year advising" : "years advising" }] : []),
    ...(typeof seller.applicantsSupported === "number" && seller.applicantsSupported > 0 ? [{ value: `${seller.applicantsSupported}+`, label: "applicants helped" }] : []),
    ...(roles.length > 0 ? [{ value: String(roles.length), label: roles.length === 1 ? "admissions role" : "admissions roles" }] : []),
    ...(clientSchools.length > 0 ? [{ value: String(clientSchools.length), label: clientSchools.length === 1 ? "school students got into" : "schools students got into" }] : []),
    ...(reviewCount > 0 && avg !== null ? [{ value: `${avg.toFixed(1)}★`, label: `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}` }] : []),
  ].slice(0, 4);
  return { first, reviewCount, avg, bestFor, school, rank, clientSchools, specialties, roles, highlights, knownFor, languages, facts };
}
