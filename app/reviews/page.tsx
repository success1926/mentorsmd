import type { Metadata } from "next";
import Link from "next/link";
import { ReviewWall } from "@/components/ReviewWall";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { getReviewWall } from "@/lib/reviewWall";
import { PageSections } from "@/components/website/PageSections";

export const dynamic = "force-dynamic"; // reads the latest reviews

export const metadata: Metadata = {
  title: "Reviews",
  description: "What students say about working with a MentorsMD mentor.",
};

// How many real reviews this page shows (newest first).
const PAGE_REVIEWS = 60;

// The review wall on its own page: the hand-picked testimonials (Admin ->
// Website -> Homepage -> Testimonials) and real reviews from completed
// orders, the same cards as the homepage. The heading, intro and the
// "no reviews yet" text are edited in Admin -> Website -> Reviews. The
// Reviews link in the top bar and footer is hidden until the homepage
// shows its wall (lib/reviewWall.ts).
export default async function ReviewsPage() {
  const [c, home] = await Promise.all([getSiteContent("reviews"), getSiteContent("home")]);
  const wall = await getReviewWall(home.testimonials, PAGE_REVIEWS);
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <div className="center-head" style={{ gap: 18 }}>
        {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
        <h1 className="big-title">{c.title}</h1>
        {paragraphs(c.intro).map((p, i) => (
          <p key={i} className="lede" style={{ maxWidth: 760, fontSize: 21 }}>{p}</p>
        ))}
      </div>
    ),
    wall:
      wall.length > 0 ? (
          <ReviewWall items={wall} />
        ) : (
          <div className="card stack" style={{ maxWidth: 640, margin: "0 auto", gap: 14, alignItems: "flex-start", background: "#fff" }}>
            <h2 style={{ fontSize: 28 }}>{c.emptyTitle}</h2>
            {paragraphs(c.emptyText).map((p, i) => (
              <p key={i} className="text-secondary" style={{ lineHeight: 1.6 }}>{p}</p>
            ))}
            <div className="row-wrap" style={{ gap: 12 }}>
              <Link href="/mentors" className="btn btn-primary">Browse Mentors</Link>
              <Link href="/how-it-works" className="btn">How It Works</Link>
            </div>
          </div>
        ),
  };
  return (
    <div className="wall" style={{ paddingTop: 64, minHeight: "60vh" }}>
      <div className="wrap stack" style={{ gap: 56 }}>
        <PageSections page="reviews" layout={c.layout} sections={sections} contained unit={40} />
      </div>
    </div>
  );
}
