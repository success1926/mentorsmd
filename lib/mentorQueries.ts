import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchableGigWhere, searchableSellerWhere, visibleMentorWhere } from "@/lib/mentor";
import { BACKGROUNDS, FORMATS, PRICE_BANDS, SCHOOL_TYPES, SERVICES, STAGES, TURNAROUNDS, isValue } from "@/lib/options";

export type BrowseFilters = {
  q: string;
  service: string[];
  format: string[];
  turnaround: string[];
  price: string[];
  stage: string[];
  school: string[];
  bg: string[];
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
    turnaround: list(sp, "turnaround", TURNAROUNDS),
    price: list(sp, "price", PRICE_BANDS),
    stage: list(sp, "stage", STAGES),
    school: list(sp, "school", SCHOOL_TYPES),
    bg: list(sp, "bg", BACKGROUNDS),
    rating: rating === 4 || rating === 4.5 ? rating : null,
    sort: ["rated", "low", "high", "new"].includes(one("sort")) ? one("sort") : "best",
  };
}

export type MentorCardData = {
  id: string;
  name: string;
  credential: string | null;
  bio: string | null;
  photoUrl: string | null;
  mentorStage: string | null;
  schoolType: string | null;
  backgrounds: string[];
  avgRating: number | null;
  reviewCount: number;
  minPrice: number;
  totalPackages: number;
  packages: {
    id: string;
    title: string;
    price: number;
    service: string | null;
    serviceOther: string | null;
    format: string | null;
    turnaround: string | null;
    callsIncluded: number;
    callLength: number | null;
  }[];
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
  title: true,
  price: true,
  service: true,
  serviceOther: true,
  format: true,
  turnaround: true,
  callsIncluded: true,
  callLength: true,
} as const;

// Browse: every visible mentor with at least one searchable package that
// matches the package filters. Mentor filters apply to the mentor.
export async function searchMentors(f: BrowseFilters): Promise<MentorCardData[]> {
  const now = new Date();

  const gigWhere: Prisma.GigWhereInput = {
    ...searchableGigWhere,
    ...(f.service.length ? { service: { in: f.service } } : {}),
    ...(f.format.length ? { format: { in: f.format } } : {}),
    ...(f.turnaround.length ? { turnaround: { in: f.turnaround } } : {}),
  };
  if (f.price.length) {
    gigWhere.OR = PRICE_BANDS.filter((b) => f.price.includes(b.value)).map((b) => ({
      price: b.max === null ? { gte: b.min } : { gte: b.min, lt: b.max },
    }));
  }

  const sellerAnd: Prisma.UserWhereInput[] = [visibleMentorWhere(now), searchableSellerWhere];
  if (f.stage.length) sellerAnd.push({ mentorStage: { in: f.stage } });
  if (f.school.length) sellerAnd.push({ schoolType: { in: f.school } });
  if (f.bg.length) sellerAnd.push({ backgrounds: { hasEvery: f.bg } });
  if (f.q) {
    sellerAnd.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { credential: { contains: f.q, mode: "insensitive" } },
        { bio: { contains: f.q, mode: "insensitive" } },
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
    where: { AND: [...sellerAnd, { gigs: { some: gigWhere } }] },
    select: {
      id: true,
      name: true,
      credential: true,
      bio: true,
      photoUrl: true,
      mentorStage: true,
      schoolType: true,
      backgrounds: true,
      createdAt: true,
      gigs: { where: gigWhere, select: gigSelect, orderBy: { price: "asc" } },
      _count: { select: { gigs: { where: searchableGigWhere } } },
    },
    take: 200,
  });

  const ratings = await ratingsFor(mentors.map((m) => m.id));
  let cards: MentorCardData[] = mentors.map((m) => {
    const r = ratings.get(m.id);
    return {
      id: m.id,
      name: m.name,
      credential: m.credential,
      bio: m.bio,
      photoUrl: m.photoUrl,
      mentorStage: m.mentorStage,
      schoolType: m.schoolType,
      backgrounds: m.backgrounds,
      avgRating: r?.avg ?? null,
      reviewCount: r?.count ?? 0,
      minPrice: m.gigs.length ? m.gigs[0].price : 0,
      totalPackages: m._count.gigs,
      packages: m.gigs,
      createdAt: m.createdAt,
    };
  });

  if (f.rating !== null) cards = cards.filter((c) => c.avgRating !== null && c.avgRating >= f.rating!);

  const byRating = (a: MentorCardData, b: MentorCardData) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.reviewCount - a.reviewCount;
  switch (f.sort) {
    case "rated":
      cards.sort(byRating);
      break;
    case "low":
      cards.sort((a, b) => a.minPrice - b.minPrice);
      break;
    case "high":
      cards.sort((a, b) => b.minPrice - a.minPrice);
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

export async function getReviewStats() {
  const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } });
  return { avg: agg._avg.rating, count: agg._count._all };
}

export async function getWallReviews(take = 8) {
  return prisma.review.findMany({
    where: { rating: { gte: 4 }, comment: { not: null } },
    include: { buyer: { select: { name: true } }, seller: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
