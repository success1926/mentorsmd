import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Avatar } from "./Avatar";

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY_REVIEW: "Essay review",
  MOCK_INTERVIEW: "Mock interview",
  APPLICATION_STRATEGY: "Application strategy",
  TUTORING: "Tutoring",
  OTHER: "Other",
};

// Soft banner colors that rotate across cards, all from the Iris palette.
const BANNERS = ["var(--tint)", "#FCE4EC", "#E4EEFF"];
const AVATARS = ["var(--primary)", "var(--ink)", "var(--primary-deep)"];

export type FeaturedCoach = {
  id: string;
  name: string;
  credential: string | null;
  bio: string | null;
  photoUrl: string | null;
  minPrice: number | null;
  categories: string[];
  avgRating: number | null;
  reviewCount: number;
};

// Real data: the most recently joined coaches who have at least one live
// package, with their starting price and review average.
export async function getFeaturedCoaches(take = 3): Promise<FeaturedCoach[]> {
  const mentors = await prisma.user.findMany({
    where: { role: "SELLER", gigs: { some: { active: true } } },
    take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      credential: true,
      bio: true, // public fields only
      photoUrl: true,
      gigs: { where: { active: true }, select: { price: true, category: true } },
    },
  });
  if (mentors.length === 0) return [];

  const ratings = await prisma.review.groupBy({
    by: ["sellerId"],
    where: { sellerId: { in: mentors.map((m) => m.id) } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.sellerId, r]));

  return mentors.map((m) => {
    const r = ratingMap.get(m.id);
    return {
      id: m.id,
      name: m.name,
      credential: m.credential,
      bio: m.bio,
      photoUrl: m.photoUrl,
      minPrice: m.gigs.length ? Math.min(...m.gigs.map((g) => g.price)) : null,
      categories: Array.from(new Set(m.gigs.map((g) => g.category))).slice(0, 3),
      avgRating: r?._avg.rating ?? null,
      reviewCount: r?._count._all ?? 0,
    };
  });
}

export function initialsOf(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function CoachCard({ coach, index }: { coach: FeaturedCoach; index: number }) {
  return (
    <Link href={`/coaches/${coach.id}`} className="card coach-card" style={{ height: "100%" }}>
      <div className="coach-card-banner" style={{ background: BANNERS[index % BANNERS.length] }}>
        <Avatar name={coach.name} photoUrl={coach.photoUrl} className="coach-card-avatar" style={{ background: AVATARS[index % AVATARS.length] }} />
      </div>
      <div className="coach-card-body">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="display" style={{ fontSize: 23 }}>{coach.name}</span>
          <VerifiedIcon />
        </div>
        {coach.credential && <div style={{ fontSize: 15, fontWeight: 600 }}>{coach.credential}</div>}
        {coach.bio && (
          <p className="text-secondary" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            {coach.bio.length > 120 ? coach.bio.slice(0, 120) + "…" : coach.bio}
          </p>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {coach.categories.map((c) => (
            <span key={c} className="tag">{CATEGORY_LABELS[c] || c}</span>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: "auto", borderTop: "1px solid var(--line)" }}>
          <span style={{ fontSize: 15 }}>
            {coach.avgRating !== null ? (
              <>
                <span className="stars">★</span> <b>{coach.avgRating.toFixed(1)}</b>{" "}
                <span className="text-secondary">({coach.reviewCount})</span>
              </>
            ) : (
              <span className="badge badge-brand">New coach</span>
            )}
          </span>
          {coach.minPrice !== null && (
            <span className="text-secondary" style={{ fontSize: 15 }}>
              from <b style={{ fontSize: 19, color: "var(--ink)" }}>${(coach.minPrice / 100).toFixed(0)}</b>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function VerifiedIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--primary)" role="img" aria-label="Verified coach">
      <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1.1 3 1.1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1.1-3-1.1-3 2.8-1.6.9-3.1 3.2.3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Kept for backward compatibility with any page still importing it.
export async function MentorSpotlight() {
  const coaches = await getFeaturedCoaches(3);
  if (coaches.length === 0) return null;
  return (
    <div className="grid-3">
      {coaches.map((c, i) => (
        <CoachCard key={c.id} coach={c} index={i} />
      ))}
    </div>
  );
}
