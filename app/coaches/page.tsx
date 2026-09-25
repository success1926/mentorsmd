import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "@/components/SearchBar";
import { CoachFilters } from "@/components/CoachFilters";
import { VerifiedIcon, initialsOf } from "@/components/MentorSpotlight";

export const dynamic = "force-dynamic"; // always show current listings, never a stale cached build

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY_REVIEW: "Essay review",
  MOCK_INTERVIEW: "Mock interview",
  APPLICATION_STRATEGY: "Application strategy",
  TUTORING: "Tutoring",
  OTHER: "Other",
};
const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

const AVATARS = ["var(--primary)", "var(--ink)", "var(--primary-deep)", "#8A3A6B", "#2E5E8C"];

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string };
}) {
  const query = (searchParams.q?.trim() || "").slice(0, 100);
  const category = VALID_CATEGORIES.includes(searchParams.category || "") ? searchParams.category! : "";
  const sort = searchParams.sort || "newest";

  const gigs = await prisma.gig.findMany({
    where: {
      active: true,
      ...(category ? { category: category as any } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { seller: { name: { contains: query, mode: "insensitive" } } },
              { seller: { credential: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { seller: { select: { id: true, name: true, credential: true, bio: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const bySeller = new Map<string, { seller: any; gigs: typeof gigs; minPrice: number }>();
  for (const gig of gigs) {
    const existing = bySeller.get(gig.sellerId);
    if (existing) {
      existing.gigs.push(gig);
      existing.minPrice = Math.min(existing.minPrice, gig.price);
    } else {
      bySeller.set(gig.sellerId, { seller: gig.seller, gigs: [gig], minPrice: gig.price });
    }
  }

  const sellers = Array.from(bySeller.values());

  // Ratings are shown on every card, so fetch them once for everyone listed.
  const ratings = sellers.length
    ? await prisma.review.groupBy({
        by: ["sellerId"],
        _avg: { rating: true },
        _count: { _all: true },
        where: { sellerId: { in: sellers.map((s) => s.seller.id) } },
      })
    : [];
  const ratingMap = new Map(ratings.map((r) => [r.sellerId, { avg: r._avg.rating || 0, count: r._count._all }]));

  if (sort === "rating") {
    sellers.sort((a, b) => (ratingMap.get(b.seller.id)?.avg || 0) - (ratingMap.get(a.seller.id)?.avg || 0));
  } else if (sort === "price_asc") {
    sellers.sort((a, b) => a.minPrice - b.minPrice);
  } else if (sort === "price_desc") {
    sellers.sort((a, b) => b.minPrice - a.minPrice);
  }
  // "newest" is already the default order from the gig query above.

  return (
    <div className="bleed" style={{ marginTop: -32 }}>
      <section style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: "44px 0 28px" }}>
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h1 className="section-title">Find your coach</h1>
              <p className="text-secondary" style={{ margin: 0, fontSize: 17 }}>
                Every coach was personally invited and verified. Message anyone for free.
              </p>
            </div>
          </div>
          <SearchBar initialValue={query} target="/coaches" placeholder="Search by name, school, specialty or service" />
          <CoachFilters query={query} category={category} sort={sort} />
        </div>
      </section>

      <div className="wrap" style={{ padding: "32px 24px 24px" }}>
        <div className="browse-layout">
          <aside className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 96 }}>
            <div className="card" style={{ background: "var(--tint)", border: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "var(--primary-deep)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" />
                </svg>
                Pay when you're happy
              </div>
              <div className="text-secondary" style={{ lineHeight: 1.5 }}>
                Payments are held until you approve the work. Ask for a revision if it's not right.
              </div>
            </div>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Message first</div>
              <div className="text-secondary" style={{ lineHeight: 1.5 }}>
                Booking unlocks once a coach replies to you, so you know they can help on your timeline.
              </div>
            </div>
          </aside>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="text-secondary" style={{ margin: 0, fontSize: 15 }}>
              <b style={{ color: "var(--ink)" }}>
                {sellers.length} coach{sellers.length !== 1 ? "es" : ""}
              </b>
              {query && ` for "${query}"`}
              {category && ` in ${CATEGORY_LABELS[category]}`}
              {(query || category) && (
                <>
                  {" · "}
                  <Link href="/coaches" style={{ textDecoration: "underline" }}>clear filters</Link>
                </>
              )}
            </p>

            {sellers.map(({ seller, gigs, minPrice }, i) => {
              const r = ratingMap.get(seller.id);
              const cats = Array.from(new Set(gigs.map((g) => g.category)));
              return (
                <article key={seller.id} className="card coach-row">
                  <div className="avatar" style={{ width: "100%", aspectRatio: "1", fontSize: 34, background: AVATARS[i % AVATARS.length] }}>
                    {initialsOf(seller.name)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Link href={`/coaches/${seller.id}`} className="display" style={{ fontSize: 23 }}>{seller.name}</Link>
                      <VerifiedIcon />
                      {r && r.count >= 3 && r.avg >= 4.8 && <span className="badge badge-brand" style={{ borderRadius: 999 }}>Top rated</span>}
                    </div>
                    {seller.credential && <div style={{ fontSize: 16, fontWeight: 600 }}>{seller.credential}</div>}
                    {seller.bio && (
                      <p className="text-secondary" style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
                        {seller.bio.length > 180 ? seller.bio.slice(0, 180) + "…" : seller.bio}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {cats.map((c) => <span key={c} className="tag">{CATEGORY_LABELS[c] || c}</span>)}
                    </div>
                    <div className="text-secondary" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {r ? (
                        <span><span className="stars">★</span> <b style={{ color: "var(--ink)" }}>{r.avg.toFixed(1)}</b> ({r.count} review{r.count !== 1 ? "s" : ""})</span>
                      ) : (
                        <span className="badge badge-brand">New coach</span>
                      )}
                      <span>{gigs.length} package{gigs.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="coach-row-price">
                    <div>
                      <div className="text-secondary">Packages from</div>
                      <div className="display" style={{ fontSize: 30 }}>${(minPrice / 100).toFixed(0)}</div>
                    </div>
                    <Link href={`/coaches/${seller.id}`} className="btn btn-solid">View profile</Link>
                  </div>
                </article>
              );
            })}

            {sellers.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <p className="text-secondary" style={{ margin: 0, fontSize: 16 }}>
                  {query || category ? "No coaches matched those filters." : "No coaches have published packages yet."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
