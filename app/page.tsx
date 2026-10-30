import Link from "next/link";
import { RoleCta } from "@/components/RoleCta";
import { ReviewWall } from "@/components/ReviewWall";
import { VettingSection } from "@/components/VettingSection";
import { FaqSection } from "@/components/FaqSection";
import { Underline } from "@/components/Underline";
import { ScrollCue } from "@/components/ScrollCue";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { getFeaturedMentors, getReviewStats } from "@/lib/mentorQueries";
import { HOME_WALL_REVIEWS, REVIEW_WALL_MIN, getReviewWall } from "@/lib/reviewWall";
import { safeHref } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { PageSections } from "@/components/website/PageSections";
import { SchoolMarquee } from "@/components/SchoolMarquee";
import { BEST_FOR, labelFor, money, STAGES } from "@/lib/options";

export const dynamic = "force-dynamic"; // mentor cards and review counts read live data

// Card colors follow each item's position (shown when a path card has no
// photo); the text, links and photos are edited in Admin -> Website
// (defaults in lib/siteContent.ts).
const PATH_BGS = [
  "linear-gradient(135deg, #DDD5FF 0%, #F1EDFF 100%)",
  "linear-gradient(135deg, #FCE4EC 0%, #F1EDFF 100%)",
  "linear-gradient(135deg, #E4EEFF 0%, #F1EDFF 100%)",
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
          {c.heroEyebrow && <span className="eyebrow">{c.heroEyebrow}</span>}
          <h1 className="hero-title">
            <Underline text={c.heroTitle} phrase={c.heroUnderline} />
          </h1>
          {c.heroSub && <p className="hero-sub">{c.heroSub}</p>}
          <form action="/mentors" method="get" className="hero-search" role="search">
            <Icon d={ICONS.search} size={20} />
            <input name="q" aria-label="Search for help" placeholder={c.searchPlaceholder} />
            <button type="submit" className="btn btn-primary">
              <span className="hide-mobile">Search Mentors</span>
              <Icon d={ICONS.arrow} size={18} />
            </button>
          </form>
          {c.quickTopics.length > 0 && (
            <div className="hero-topics">
              <span>Popular:</span>
              {c.quickTopics.map((q, i) => (
                <Link key={i} href={safeHref(q.href)}>
                  {q.label}
                </Link>
              ))}
            </div>
          )}
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

        <ScrollCue />

        {c.schools.length > 0 && (
          <div className="wrap">
            <div className="school-strip">
              <span className="eyebrow">{c.schoolsLabel}</span>
              <div className="school-strip-names">
                {c.schools.map((s, i) => (
                  <b key={i}>{s}</b>
                ))}
              </div>
            </div>
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
            {c.pathsEyebrow && <span className="eyebrow">{c.pathsEyebrow}</span>}
            <h2 className="big-title">
              <Underline text={c.pathsTitle} phrase={c.pathsUnderline} />
            </h2>
            {c.pathsText && <p className="lede" style={{ maxWidth: 760, marginTop: 8 }}>{c.pathsText}</p>}
          </div>
          <div className="grid-3" style={{ marginTop: 56 }}>
            {c.paths.map((p, i) => (
              <Link key={i} href={safeHref(p.href)} className="path-card">
                <div className="path-photo" style={{ background: PATH_BGS[i % PATH_BGS.length] }}>
                  {p.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stripFocus(p.photo)} alt="" loading="lazy" style={{ objectPosition: focusPosition(p.photo) }} />
                  )}
                </div>
                <div className="path-body">
                  <h3>{p.title}</h3>
                  {p.body && <p>{p.body}</p>}
                  {p.button && <span className="link">{p.button}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    ),

    // Also on /how-it-works.
    vetting: <VettingSection c={c} id="vetting" />,

    // No bottom space here: the next section brings its own, so the gap stays
    // the same when this row is hidden (no mentors yet).
    featured: mentors.length > 0 && (
        <section className="home-section" style={{ paddingBottom: 0 }}>
          <div className="wrap">
            <div className="between" style={{ alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap", gap: 24 }}>
              <div className="stack" style={{ gap: 14 }}>
                {c.featuredEyebrow && <span className="eyebrow">{c.featuredEyebrow}</span>}
                <h2 className="section-head">{c.featuredTitle}</h2>
              </div>
              {c.featuredLink && <Link href="/mentors" className="link">{c.featuredLink}</Link>}
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
                    <div className="stack-sm" style={{ gap: 4 }}>
                      <div className="between" style={{ alignItems: "baseline" }}>
                        <b className="mentor-tile-name">{m.name}</b>
                        <Rating avg={m.avgRating} count={m.reviewCount} />
                      </div>
                      <span className="text-secondary">
                        {m.credential || labelFor(STAGES, m.mentorStage)}
                        {firstBestFor && <> · Best for {labelFor(BEST_FOR, firstBestFor)}</>}
                      </span>
                      {m.fromRateCents && (
                        <span className="text-secondary" style={{ marginTop: 4 }}>
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
      <section className="home-section">
        <div className="wrap">
          <div className="stack" style={{ gap: 14, marginBottom: 44 }}>
            {c.featuresEyebrow && <span className="eyebrow">{c.featuresEyebrow}</span>}
            <h2 className="section-head">
              <Underline text={c.featuresTitle} phrase={c.featuresUnderline} />
            </h2>
          </div>
          <div className="feature-grid">
            {c.features.map((f, i) => (
              <div key={i}>
                <h3>{f.title}</h3>
                {f.body && <p>{f.body}</p>}
                {!f.cta ? null : f.href === "/signup" ? (
                  <RoleCta href={f.href} label={`${f.cta} →`} className="link" />
                ) : (
                  <Link href={safeHref(f.href)} className="link">{f.cta} →</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    testimonials: wall.length >= REVIEW_WALL_MIN && (
        <section id="reviews" className="wall" style={{ scrollMarginTop: 150 }}>
          <div className="wrap">
            <div className="center-head" style={{ marginBottom: 56, gap: 16 }}>
              {c.testimonialsEyebrow && <span className="eyebrow">{c.testimonialsEyebrow}</span>}
              <h2 className="big-title">{c.testimonialsTitle}</h2>
            </div>
            <ReviewWall items={wall} />
          </div>
        </section>
    ),

    // Only once questions are added in Admin -> Website; also on /how-it-works.
    faq: <FaqSection title={c.faqTitle} faq={c.faq} />,

    cta: (
      <section className="home-section home-cta">
        <div className="wrap center-head" style={{ gap: 20 }}>
          {c.ctaEyebrow && <span className="eyebrow">{c.ctaEyebrow}</span>}
          <h2 className="big-title">{c.ctaTitle}</h2>
          {c.ctaText && <p className="lede">{c.ctaText}</p>}
          <RoleCta href="/mentors" label={c.ctaButton} className="btn btn-primary btn-lg" style={{ marginTop: 8 }} />
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
