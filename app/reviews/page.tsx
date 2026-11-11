import type { Metadata } from "next";
import Link from "next/link";
import { ReviewWall } from "@/components/ReviewWall";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { getReviewWall } from "@/lib/reviewWall";
import { PageSections } from "@/components/website/PageSections";
import { SchoolMarquee } from "@/components/SchoolMarquee";
import { getReviewStats } from "@/lib/mentorQueries";

export const dynamic = "force-dynamic"; // reads the latest reviews

export const metadata: Metadata = {
  title: "Reviews",
  description: "What students say about working with a MentorsMD mentor.",
};

// How many real reviews this page shows (newest first).
const PAGE_REVIEWS = 60;

// The review wall on its own page: the hand-picked testimonials (Admin ->
// Website -> Homepage -> Testimonials) and real reviews from completed
// orders, the same cards as the homepage. Laid out like Leland's reviews
// page (Nov 2026): heading, rating summary and buttons, the "where our
// students have been accepted" ticker, then the wall. The heading, intro
// and the "no reviews yet" text are edited in Admin -> Website -> Reviews.
// The Reviews link is always in the top bar and footer (Nov 2026).
export default async function ReviewsPage() {
  const [c, home, settings, stats] = await Promise.all([getSiteContent("reviews"), getSiteContent("home"), getSiteContent("siteSettings"), getReviewStats().catch(() => ({ avg: null, count: 0 }))]);
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
        {/* Rating summary (Leland-style, Nov 2026): only real reviews count. */}
        {stats.count > 0 && stats.avg !== null && (
          <div className="review-summary">
            <span className="review-summary-avg">{stats.avg.toFixed(1)}</span>
            <span className="stack-sm" style={{ gap: 2, alignItems: "flex-start" }}>
              <span className="stars" aria-label={`${stats.avg.toFixed(1)} out of 5 stars`}>{"★".repeat(Math.round(stats.avg))}{"☆".repeat(5 - Math.round(stats.avg))}</span>
              <span className="text-secondary">
                from {stats.count} {stats.count === 1 ? "review" : "reviews"} of completed packages
              </span>
            </span>
          </div>
        )}
        <div className="row-wrap" style={{ justifyContent: "center", gap: 12 }}>
          <Link href="/mentors" className="btn btn-primary">Find Your Mentor</Link>
          <Link href="/how-it-works" className="btn">How It Works</Link>
        </div>
      </div>
    ),
    // The schools ticker (Admin -> Website -> Site settings); hidden while empty.
    accepted: settings.acceptedSchools.length > 0 && <SchoolMarquee label={settings.acceptedTitle} schools={settings.acceptedSchools} contained />,
    wall:
      wall.length > 0 ? (
          <ReviewWall items={wall} />
        ) : (
          <div className="card stack" style={{ maxWidth: 640, margin: "0 auto", gap: 14, alignItems: "flex-start", background: "#fff" }}>
            <h2 style={{ fontSize: 28 }}>{c.emptyTitle}</h2>
            {paragraphs(c.emptyText).map((p, i) => (
              <p key={i} className="text-secondary" style={{ lineHeight: 1.6 }}>{p}</p>
            ))}
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
