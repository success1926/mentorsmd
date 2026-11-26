import type { Metadata } from "next";
import Link from "next/link";
import { ReviewWall } from "@/components/ReviewWall";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { getReviewWall } from "@/lib/reviewWall";
import { PageSections } from "@/components/website/PageSections";
import { SchoolMarquee } from "@/components/SchoolMarquee";
import { getReviewStats } from "@/lib/mentorQueries";
import { Collapsible, EmptyState, SectionHead, Stars } from "@/components/ui";

export const dynamic = "force-dynamic"; // reads the latest reviews

export const metadata: Metadata = { alternates: { canonical: "/reviews" },
  title: "Reviews",
  description: "What students say about working with a MentorsMD mentor.",
};

// How many real reviews this page shows (newest first), and how many before "Show all".
const PAGE_REVIEWS = 60;
const FIRST_REVIEWS = 12;

// The review wall on its own page: the hand-picked testimonials (Admin ->
// Website -> Homepage -> Testimonials) and real reviews from completed
// orders, the same cards as the homepage. Laid out like Leland's reviews
// page (Nov 2026): heading, rating summary and buttons, the "where our
// students have been accepted" ticker, then the wall. The heading, intro
// and the "no reviews yet" text are edited in Admin -> Website -> Reviews.
// The Reviews link shows in the top bar and footer once hasReviewWall() is true.
export default async function ReviewsPage() {
  const [c, home, settings, stats] = await Promise.all([getSiteContent("reviews"), getSiteContent("home"), getSiteContent("siteSettings"), getReviewStats().catch(() => ({ avg: null, count: 0 }))]);
  const wall = await getReviewWall(home.testimonials, PAGE_REVIEWS);
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const first = wall.slice(0, FIRST_REVIEWS);
  const rest = wall.slice(FIRST_REVIEWS);
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <div className="center-head">
        <SectionHead center as="h1" titleClassName="page-title" eyebrow={c.eyebrow} title={c.title} />
        {paragraphs(c.intro).map((p, i) => (
          <p key={i} className="lede reviews-lede">{p}</p>
        ))}
        {/* Rating summary (Leland-style, Nov 2026): only real reviews count. */}
        {stats.count > 0 && stats.avg !== null && (
          <div className="review-summary">
            <span className="review-summary-avg">{stats.avg.toFixed(1)}</span>
            <span className="stack-sm review-summary-text">
              <Stars value={stats.avg} showValue={false} />
              <span className="text-secondary">
                from {stats.count} {stats.count === 1 ? "review" : "reviews"} of completed packages
              </span>
            </span>
          </div>
        )}
      </div>
    ),
    // The schools ticker (Admin -> Website -> Site settings); hidden while empty.
    accepted: settings.acceptedSchools.length > 0 && <SchoolMarquee label={settings.acceptedTitle} schools={settings.acceptedSchools} contained />,
    // The first 12, then the rest behind "Show all", then one call to action.
    wall:
      wall.length > 0 ? (
        <div className="stack reviews-wall">
          <ReviewWall items={first} />
          {rest.length > 0 && (
            <Collapsible variant="inline" title={`Show all ${wall.length} reviews`} className="reviews-more">
              <ReviewWall items={rest} />
            </Collapsible>
          )}
          <div className="reviews-cta">
            <Link href="/mentors" className="btn btn-primary btn-lg">Find your mentor</Link>
          </div>
        </div>
      ) : (
        <EmptyState title={c.emptyTitle} action={<Link href="/how-it-works" className="btn">How it works</Link>}>
          {paragraphs(c.emptyText).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </EmptyState>
      ),
  };
  return (
    <div className="wall reviews-page">
      <div className="wrap stack reviews-stack">
        <PageSections page="reviews" layout={c.layout} sections={sections} contained unit={40} />
      </div>
    </div>
  );
}
