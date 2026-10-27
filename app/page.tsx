import Link from "next/link";
import { HomeFeatures } from "@/components/HomeFeatures";
import { RoleCta } from "@/components/RoleCta";
import { ReviewWall } from "@/components/ReviewWall";
import { VettingSection } from "@/components/VettingSection";
import { FaqSection } from "@/components/FaqSection";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { getFeaturedMentors, getReviewStats } from "@/lib/mentorQueries";
import { HOME_WALL_REVIEWS, REVIEW_WALL_MIN, getReviewWall } from "@/lib/reviewWall";
import { safeHref } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { Fragment } from "react";
import { PageSections } from "@/components/website/PageSections";
import { SchoolMarquee } from "@/components/SchoolMarquee";
import { BEST_FOR, labelFor, money, STAGES } from "@/lib/options";

export const dynamic = "force-dynamic"; // mentor cards and review counts read live data

// Icons and card colors follow each item's position; the text, links and
// photos are edited in Admin -> Website (defaults in lib/siteContent.ts).
const QUICK_ICONS = [ICONS.pen, ICONS.doc, ICONS.chat, ICONS.chart, ICONS.cycle];
const PATH_BGS = [
  "linear-gradient(180deg, #CFC4FF 0%, #8E78F0 50%, #2B1F6B 100%)",
  "linear-gradient(180deg, #F5B9CD 0%, #9A7BE8 50%, #2B1F6B 100%)",
  "linear-gradient(180deg, #E4EEFF 0%, #8E9BF0 50%, #2B1F6B 100%)",
];

export default async function HomePage() {
  const [mentors, stats, c, settings] = await Promise.all([getFeaturedMentors(4), getReviewStats(), getSiteContent("home"), getSiteContent("siteSettings")]);
  const wall = await getReviewWall(c.testimonials, HOME_WALL_REVIEWS);

  // Each section by its id in lib/pageLayout.ts; shown in the order (and
  // with the hidden ones and added sections) from Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    hero: (
      <section className="home-hero">
        <div className="blob" style={{ left: -120, top: 420, width: 520, height: 260, background: "rgba(228,238,255,0.9)", filter: "blur(50px)" }} />
        <div className="blob" style={{ right: -80, top: 300, width: 560, height: 300, background: "rgba(245,185,205,0.45)", filter: "blur(60px)" }} />
        <div className="blob" style={{ left: "35%", top: 40, width: 520, height: 200, background: "rgba(207,196,255,0.45)", filter: "blur(60px)" }} />

        <div className="hero-body">
          <h1 className="hero-title">{c.heroTitle}</h1>
          {c.heroSub && <p className="hero-sub">{c.heroSub}</p>}
          <form action="/mentors" method="get" className="hero-search" role="search">
            <Icon d={ICONS.search} size={22} />
            <input name="q" aria-label="Search for help" placeholder={c.searchPlaceholder} />
            <button type="submit" aria-label="Search mentors">
              <Icon d={ICONS.arrow} size={22} />
            </button>
          </form>
          <div className="row-wrap" style={{ justifyContent: "center", gap: 10 }}>
            {c.quickTopics.map((q, i) => (
              <Link key={i} href={safeHref(q.href)} className="chip">
                <Icon d={QUICK_ICONS[i % QUICK_ICONS.length]} size={17} />
                {q.label}
              </Link>
            ))}
          </div>
          {stats.count >= 3 && stats.avg !== null && (
            <div className="hero-proof">
              <div className="hero-dots" aria-hidden="true">
                <span style={{ background: "#F5B9CD" }} />
                <span style={{ background: "#E4EEFF" }} />
                <span style={{ background: "#DDD5FF" }} />
                <span style={{ background: "#FCE4EC" }} />
              </div>
              <div style={{ fontSize: 18 }}>
                <span className="stars">★★★★★</span> <b>{stats.count} reviews</b> <span style={{ opacity: 0.5 }}>|</span>{" "}
                <span className="text-secondary" style={{ fontSize: 18 }}>{stats.avg.toFixed(1)} avg</span>
              </div>
            </div>
          )}
        </div>

        {c.schools.length > 0 && (
          <div className="school-strip">
            <span>{c.schoolsLabel}</span>
            {c.schools.map((s, i) => (
              <b key={i}>{s}</b>
            ))}
          </div>
        )}
      </section>
    ),

    // Schools picked in Admin -> Website -> Site settings; hidden while empty.
    schoolLogos: settings.mentorSchools.length > 0 && <SchoolMarquee label={settings.mentorSchoolsTitle} schools={settings.mentorSchools} />,

    paths: (
      <section className="home-section">
        <div className="wrap">
          <div className="center-head">
            <h2 className="big-title">
              <Lines text={c.pathsTitle} />
            </h2>
            {c.pathsText && (
              <p className="lede" style={{ maxWidth: 880, fontSize: 21 }}>
                {c.pathsText}
              </p>
            )}
          </div>
          <div className="grid-3" style={{ marginTop: 56 }}>
            {c.paths.map((p, i) => (
              <div key={i} className="path-card" style={{ background: PATH_BGS[i % PATH_BGS.length] }}>
                {p.photo && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="path-photo" src={stripFocus(p.photo)} alt="" style={{ objectPosition: focusPosition(p.photo) }} />
                    <div className="path-shade" />
                  </>
                )}
                <h3>{p.title}</h3>
                {p.body && <p>{p.body}</p>}
                {p.button && <Link href={safeHref(p.href)} className="btn">{p.button}</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    // Also on /how-it-works.
    vetting: <VettingSection c={c} id="vetting" />,

    featured: mentors.length > 0 && (
        <section style={{ paddingBottom: 130 }}>
          <div className="wrap">
            <div className="between" style={{ alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "clamp(34px, 4.4vw, 64px)" }}>{c.featuredTitle}</h2>
              {c.featuredLink && <Link href="/mentors" className="link" style={{ fontSize: 18 }}>{c.featuredLink}</Link>}
            </div>
            <div className="grid-4">
              {mentors.map((m) => {
                const firstBestFor = m.bestFor[0];
                return (
                  <Link key={m.id} href={`/mentors/${m.id}`} className="mentor-tile">
                    <div className="mentor-tile-photo" style={{ background: tintFor(m.id) }}>
                      {m.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photoUrl} alt={m.name} loading="lazy" />
                      ) : (
                        initialsOf(m.name)
                      )}
                      <Vetted />
                    </div>
                    <div className="stack-sm" style={{ gap: 6 }}>
                      <div className="between" style={{ alignItems: "baseline" }}>
                        <b style={{ fontSize: 21, fontWeight: 600 }}>{m.name}</b>
                        <Rating avg={m.avgRating} count={m.reviewCount} />
                      </div>
                      <span className="text-secondary" style={{ fontSize: 16 }}>
                        {m.credential || labelFor(STAGES, m.mentorStage)}
                      </span>
                      {firstBestFor && <span style={{ fontSize: 16 }}>Best for: {labelFor(BEST_FOR, firstBestFor)}</span>}
                      {m.fromRateCents && (
                        <span className="text-secondary" style={{ fontSize: 15 }}>
                          From <b style={{ color: "var(--ink)" }}>{money(m.fromRateCents)}/hr</b>
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
    ),

    features: (
      <section style={{ paddingBottom: 140 }}>
        <div className="wrap">
          <h2 className="big-title" style={{ textAlign: "center", marginBottom: 64 }}>{c.featuresTitle}</h2>
          <HomeFeatures features={c.features.map((f) => ({ ...f, href: safeHref(f.href) }))} />
        </div>
      </section>
    ),

    testimonials: wall.length >= REVIEW_WALL_MIN && (
        <section id="reviews" className="wall" style={{ scrollMarginTop: 150 }}>
          <div className="wrap">
            <div className="center-head" style={{ marginBottom: 56, gap: 18 }}>
              <span className="eyebrow" style={{ color: "var(--ink)", fontSize: 18, fontWeight: 500 }}>{c.testimonialsEyebrow}</span>
              <h2 className="big-title">{c.testimonialsTitle}</h2>
            </div>
            <ReviewWall items={wall} />
          </div>
        </section>
    ),

    // Only once questions are added in Admin -> Website; also on /how-it-works.
    faq: <FaqSection title={c.faqTitle} faq={c.faq} />,

    cta: (
      <section className="home-section">
        <div className="wrap center-head" style={{ gap: 24 }}>
          <h2 className="big-title">{c.ctaTitle}</h2>
          {c.ctaText && (
            <p className="lede" style={{ fontSize: 21 }}>
              {c.ctaText}
            </p>
          )}
          <RoleCta href="/mentors" label={c.ctaButton} className="btn btn-primary btn-lg" style={{ padding: "20px 38px", fontSize: 19 }} />
        </div>
      </section>
    ),
  };

  return (
    <div>
      <PageSections page="home" layout={c.layout} sections={sections} navGap="hero" />
    </div>
  );
}

// A heading where each line break in the text starts a new line.
function Lines({ text }: { text: string }) {
  const parts = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <>
      {parts.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {l}
        </Fragment>
      ))}
    </>
  );
}
