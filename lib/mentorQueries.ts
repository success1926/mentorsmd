import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicCache, toDate } from "@/lib/publicCache";
import { searchableGigWhere, visibleMentorWhere } from "@/lib/mentor";
import { completeProfileWhere } from "@/lib/profileCompleteness";
import { BEST_FOR, FORMATS, PRICE_BANDS, SCHOOL_TYPES, SERVICES, SERVICE_TO_STAGE, STAGES, isValue, mentorSchoolName } from "@/lib/options";

export type BrowseFilters = {
  q: string;
  service: string[];
  format: string[];
  price: string[];
  stage: string[];
  school: string[];
  best: string[];
  rating: number | null;
  sort: string;
};

type SP = Record<string, string | string[] | undefined>;

function list(sp: SP, key: string, allowed: { value: string }[]): string[] {
  const raw = sp[key];
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(","));
  return Array.from(new Set(values.filter((v) => isValue(allowed as any, v))));
}

export function parseBrowseFilters(sp: SP): BrowseFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) || "";
  const rating = parseFloat(one("rating"));
  return {
    q: one("q").trim().slice(0, 100),
    service: list(sp, "service", SERVICES),
    format: list(sp, "format", FORMATS),
    price: list(sp, "price", PRICE_BANDS),
    stage: list(sp, "stage", STAGES),
    school: list(sp, "school", SCHOOL_TYPES),
    best: list(sp, "best", BEST_FOR),
    rating: rating === 4 || rating === 4.5 ? rating : null,
    sort: ["rated", "low", "high", "new"].includes(one("sort")) ? one("sort") : "best",
  };
}

export type MentorCardData = {
  id: string;
  name: string;
  credential: string | null;
  medicalSchool: string | null;
  bio: string | null;
  photoUrl: string | null;
  mentorStage: string | null;
  schoolType: string | null;
  bestFor: string[];
  avgRating: number | null;
  reviewCount: number;
  hourlyRateCents: number | null;
  // The lowest per-hour rate across the mentor's offers ("from $X/hr").
  fromRateCents: number | null;
  totalPackages: number; // specialized packages
  packages: { id: string; title: string; minutes: number | null; format: string | null }[];
  createdAt: Date;
};

type RatingInfo = { avg: number | null; count: number };
async function ratingsFor(ids: string[]): Promise<Map<string, RatingInfo>> {
  if (ids.length === 0) return new Map<string, RatingInfo>();
  const rows = await prisma.review.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: ids } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map<string, RatingInfo>(rows.map((r) => [r.sellerId, { avg: r._avg.rating, count: r._count._all }] as [string, RatingInfo]));
}

const gigSelect = {
  id: true,
  kind: true,
  title: true,
  price: true,
  minutes: true,
  rateCents: true,
  format: true,
  sortOrder: true,
} as const;

// Browse: every listed mentor (visible, profile complete) who matches the
// filters. Offer filters (format, price) need at least one matching offer;
// a service matches a specialized package of that service OR one of the
// mentor's strongest stages, so hourly-only mentors can be found too.
// Shared by all visitors for up to a minute (lib/publicCache.ts), one cached
// result per set of filters.
const cachedSearch = publicCache("browse-mentors-v1", (f: BrowseFilters) => searchMentorsFresh(f));

export async function searchMentors(f: BrowseFilters): Promise<MentorCardData[]> {
  const cards = await cachedSearch(f);
  return cards.map((c) => ({ ...c, createdAt: toDate(c.createdAt) }));
}

async function searchMentorsFresh(f: BrowseFilters): Promise<MentorCardData[]> {
  const now = new Date();

  const gigWhere: Prisma.GigWhereInput = {
    ...searchableGigWhere,
    ...(f.format.length ? { format: { in: f.format } } : {}),
  };
  if (f.price.length) {
    gigWhere.OR = PRICE_BANDS.filter((b) => f.price.includes(b.value)).map((b) => ({
      price: b.max === null ? { gte: b.min } : { gte: b.min, lt: b.max },
    }));
  }
  const offerFiltered = f.format.length + f.price.length > 0;

  const sellerAnd: Prisma.UserWhereInput[] = [visibleMentorWhere(now), completeProfileWhere];
  if (offerFiltered) sellerAnd.push({ gigs: { some: gigWhere } });
  if (f.service.length) {
    const stages = Array.from(new Set(f.service.map((s) => SERVICE_TO_STAGE[s]).filter(Boolean)));
    sellerAnd.push({
      OR: [
        { gigs: { some: { ...searchableGigWhere, service: { in: f.service } } } },
        ...(stages.length ? [{ strongestStages: { hasSome: stages } }] : []),
      ],
    });
  }
  if (f.stage.length) sellerAnd.push({ mentorStage: { in: f.stage } });
  if (f.school.length) sellerAnd.push({ schoolType: { in: f.school } });
  if (f.best.length) sellerAnd.push({ bestFor: { hasEvery: f.best } });
  if (f.q) {
    sellerAnd.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { credential: { contains: f.q, mode: "insensitive" } },
        { medicalSchool: { contains: f.q, mode: "insensitive" } },
        { undergradSchool: { contains: f.q, mode: "insensitive" } },
        { bio: { contains: f.q, mode: "insensitive" } },
        { specialtyInterest: { contains: f.q, mode: "insensitive" } },
        { researchSummary: { contains: f.q, mode: "insensitive" } },
        {
          gigs: {
            some: {
              ...searchableGigWhere,
              OR: [
                { title: { contains: f.q, mode: "insensitive" } },
                { description: { contains: f.q, mode: "insensitive" } },
                // custom "Other" service names, e.g. "CASPer prep"
                { serviceOther: { contains: f.q, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  const mentors = await prisma.user.findMany({
    where: { AND: sellerAnd },
    select: {
      id: true,
      name: true,
      credential: true,
      medicalSchool: true,
      undergradSchool: true,
      bio: true,
      photoUrl: true,
      mentorStage: true,
      schoolType: true,
      bestFor: true,
      hourlyRateCents: true,
      createdAt: true,
      gigs: { where: searchableGigWhere, select: gigSelect, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
    take: 200,
  });

  const ratings = await ratingsFor(mentors.map((m) => m.id));
  let cards: MentorCardData[] = mentors.map((m) => {
    const r = ratings.get(m.id);
    const rates = [m.hourlyRateCents, ...m.gigs.map((g) => g.rateCents ?? m.hourlyRateCents)].filter((x): x is number => !!x);
    const specialized = m.gigs.filter((g) => g.kind === "SPECIALIZED");
    return {
      id: m.id,
      name: m.name,
      credential: m.credential,
      // The school shown on the card: the college for undergrads.
      medicalSchool: mentorSchoolName(m),
      bio: m.bio,
      photoUrl: m.photoUrl,
      mentorStage: m.mentorStage,
      schoolType: m.schoolType,
      bestFor: m.bestFor,
      avgRating: r?.avg ?? null,
      reviewCount: r?.count ?? 0,
      hourlyRateCents: m.hourlyRateCents,
      fromRateCents: rates.length ? Math.min(...rates) : null,
      totalPackages: specialized.length,
      packages: specialized.map((g) => ({ id: g.id, title: g.title, minutes: g.minutes, format: g.format })),
      createdAt: m.createdAt,
    };
  });

  if (f.rating !== null) cards = cards.filter((c) => c.avgRating !== null && c.avgRating >= f.rating!);

  const rateOf = (c: MentorCardData) => c.fromRateCents ?? Number.MAX_SAFE_INTEGER;
  const byRating = (a: MentorCardData, b: MentorCardData) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.reviewCount - a.reviewCount;
  switch (f.sort) {
    case "rated":
      cards.sort(byRating);
      break;
    case "low":
      cards.sort((a, b) => rateOf(a) - rateOf(b));
      break;
    case "high":
      cards.sort((a, b) => (b.fromRateCents ?? 0) - (a.fromRateCents ?? 0));
      break;
    case "new":
      cards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    default:
      // "Best match": rated mentors first (by rating x review count), then newest.
      cards.sort((a, b) => {
        const sa = (a.avgRating ?? 0) * Math.log2(2 + a.reviewCount);
        const sb = (b.avgRating ?? 0) * Math.log2(2 + b.reviewCount);
        return sb - sa || b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
  return cards;
}

// Homepage "Meet a few of our mentors".
export async function getFeaturedMentors(take = 4) {
  const all = await searchMentors(parseBrowseFilters({}));
  return all.slice(0, take);
}

export const getReviewStats = publicCache("review-stats-v1", async () => {
  const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } });
  return { avg: agg._avg.rating, count: agg._count._all };
});

// Reviews good enough for the review wall (homepage and /reviews).
const WALL_REVIEW_WHERE: Prisma.ReviewWhereInput = { rating: { gte: 4 }, comment: { not: null } };

export async function getWallReviews(take = 8) {
  return prisma.review.findMany({
    where: WALL_REVIEW_WHERE,
    include: { buyer: { select: { name: true } }, seller: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countWallReviews() {
  return prisma.review.count({ where: WALL_REVIEW_WHERE });
}
