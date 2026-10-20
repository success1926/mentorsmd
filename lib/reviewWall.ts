import { unstable_cache } from "next/cache";
import { countWallReviews, getWallReviews } from "@/lib/mentorQueries";
import { publicCache } from "@/lib/publicCache";
import { getSiteContent } from "@/lib/siteContentStore";

// The review wall: hand-picked testimonials (Admin -> Website -> Homepage ->
// Testimonials) followed by real reviews from completed orders. Shown on the
// homepage (#reviews) and on /reviews. The homepage section, and the Reviews
// link in the top bar and footer, only show once there are at least
// REVIEW_WALL_MIN in total.

export const REVIEW_WALL_MIN = 3;
// How many real reviews the homepage wall shows.
export const HOME_WALL_REVIEWS = 8;

export type WallItem = { key: string; name: string; detail: string; quote: string; rating: number };

type Testimonial = { name: string; detail: string; quote: string; rating: string };

function testimonialItems(testimonials: Testimonial[]): WallItem[] {
  return testimonials.map((t, i) => ({ key: `t-${i}`, name: t.name, detail: t.detail, quote: t.quote, rating: Math.min(5, Math.max(1, Number(t.rating) || 5)) }));
}

// Testimonials first, then the newest real reviews (first name + last
// initial). If the reviews can't be read, the testimonials still show.
// The newest real reviews as wall items, shared by all visitors for up to a
// minute (lib/publicCache.ts).
const cachedReviewItems = publicCache("wall-reviews-v1", async (take: number): Promise<WallItem[]> =>
  (await getWallReviews(take)).map((r) => {
    const [first, second] = r.buyer.name.split(" ");
    return {
      key: r.id,
      name: first + (second ? ` ${second[0]}.` : ""),
      detail: `Worked with ${r.seller.name}`,
      quote: r.comment || "",
      rating: r.rating,
    };
  }),
);

export async function getReviewWall(testimonials: Testimonial[], take: number): Promise<WallItem[]> {
  let reviews: WallItem[] = [];
  try {
    reviews = await cachedReviewItems(take);
  } catch (err) {
    console.error("Couldn't load reviews for the review wall:", err);
  }
  return [...testimonialItems(testimonials), ...reviews];
}

const cachedWallReviewCount = unstable_cache(() => countWallReviews(), ["wall-review-count-v1"], { revalidate: 300 });

// True when the homepage shows its review wall, i.e. when the Reviews
// links in the top bar and footer have something to show. Same rule as the
// homepage: testimonials + up to HOME_WALL_REVIEWS real reviews >= REVIEW_WALL_MIN.
export async function hasReviewWall(): Promise<boolean> {
  const c = await getSiteContent("home");
  let count = 0;
  try {
    count = await cachedWallReviewCount();
  } catch {
    // Database unreachable: count only the testimonials.
  }
  return c.testimonials.length + Math.min(count, HOME_WALL_REVIEWS) >= REVIEW_WALL_MIN;
}
