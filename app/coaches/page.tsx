import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "@/components/SearchBar";
import { CoachFilters } from "@/components/CoachFilters";

export const dynamic = "force-dynamic"; // always show current listings, never a stale cached build

const CATEGORY_LABELS: Record<string, string> = {
  ESSAY_REVIEW: "Essay review",
  MOCK_INTERVIEW: "Mock interview",
  APPLICATION_STRATEGY: "Application strategy",
  TUTORING: "Tutoring",
  OTHER: "Other",
};

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; sort?: string };
}) {
  const query = searchParams.q?.trim() || "";
  const category = searchParams.category || "";
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
    include: { seller: { select: { id: true, name: true, credential: true } } },
    orderBy: { createdAt: "desc" },
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

  let sellers = [...bySeller.values()];

  // Rating sort needs actual review data, pulled separately since it's
  // not part of the gig/seller query above.
  if (sort === "rating") {
    const ratings = await prisma.review.groupBy({
      by: ["sellerId"],
      _avg: { rating: true },
      where: { sellerId: { in: sellers.map((s) => s.seller.id) } },
    });
    const ratingMap = new Map(ratings.map((r) => [r.sellerId, r._avg.rating || 0]));
    sellers.sort((a, b) => (ratingMap.get(b.seller.id) || 0) - (ratingMap.get(a.seller.id) || 0));
  } else if (sort === "price_asc") {
    sellers.sort((a, b) => a.minPrice - b.minPrice);
  } else if (sort === "price_desc") {
    sellers.sort((a, b) => b.minPrice - a.minPrice);
  }
  // "newest" is already the default order from the gig query above.

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 20 }}>Find a coach</h1>

      <div style={{ marginBottom: 14 }}>
        <SearchBar initialValue={query} target="/coaches" />
      </div>
      <div style={{ marginBottom: 28 }}>
        <CoachFilters query={query} category={category} sort={sort} />
      </div>

      {(query || category) && (
        <p className="text-secondary" style={{ marginBottom: 14 }}>
          {sellers.length} result{sellers.length !== 1 ? "s" : ""}
          {query && ` for "${query}"`}
          {category && ` in ${CATEGORY_LABELS[category]}`} ·{" "}
          <Link href="/coaches" className="text-secondary" style={{ textDecoration: "underline" }}>clear</Link>
        </p>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {sellers.map(({ seller, gigs, minPrice }) => (
          <Link key={seller.id} href={`/coaches/${seller.id}`} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: "#1E5631" }}>
                {seller.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{seller.name}</div>
                <div className="text-secondary">{seller.credential}</div>
                <div className="text-muted" style={{ marginTop: 4 }}>
                  {gigs.length} package{gigs.length !== 1 ? "s" : ""} · from ${(minPrice / 100).toFixed(0)}
                </div>
              </div>
            </div>
            <span className="btn">View profile</span>
          </Link>
        ))}
        {sellers.length === 0 && (
          <p className="text-muted">
            {query || category ? "No coaches or packages matched those filters." : "No coaches have published packages yet."}
          </p>
        )}
      </div>
    </div>
  );
}
