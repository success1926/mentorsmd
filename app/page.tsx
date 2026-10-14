import Link from "next/link";
import { HomeFeatures } from "@/components/HomeFeatures";
import { RoleCta } from "@/components/RoleCta";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { getFeaturedMentors, getReviewStats, getWallReviews } from "@/lib/mentorQueries";
import { paragraphs, safeHref } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { Fragment } from "react";
import { labelFor, money, STAGES, serviceLabel } from "@/lib/options";

export const dynamic = "force-dynamic"; // mentor cards and review counts read live data

// Icons and card colors follow each item's position; the text, links and
// photos are edited in Admin -> Website (defaults in lib/siteContent.ts).
const QUICK_ICONS = [ICONS.pen, ICONS.doc, ICONS.chat, ICONS.chart, ICONS.cycle];
const PATH_BGS = [
  "linear-gradient(180deg, #CFC4FF 0%, #8E78F0 50%, #2B1F6B 100%)",
  "linear-gradient(180deg, #F5B9CD 0%, #9A7BE8 50%, #2B1F6B 100%)",
  "linear-gradient(180deg, #E4EEFF 0%, #8E9BF0 50%, #2B1F6B 100%)",
];
const VET_ICONS = [ICONS.chat, ICONS.doc, ICONS.check, ICONS.star];

export default async function HomePage() {
  const [mentors, stats, reviews, c] = await Promise.all([getFeaturedMentors(4), getReviewStats(), getWallReviews(8), getSiteContent("home")]);

  const wall = [
    ...c.testimonials.map((t, i) => ({ key: `t-${i}`, name: t.name, detail: t.detail, quote: t.quote, rating: Math.min(5, Math.max(1, Number(t.rating) || 5)) })),
    ...reviews.map((r) => ({
      key: r.id,
      name: r.buyer.name.split(" ")[0] + (r.buyer.name.split(" ")[1] ? ` ${r.buyer.name.split(" ")[1][0]}.` : ""),
      detail: `Worked with ${r.seller.name}`,
      quote: r.comment || "",
      rating: r.rating,
    })),
  ];

  return (
    <div>
      {/* ---------------- Hero ---------------- */}
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

      {/* ---------------- Three paths ---------------- */}
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

      {/* ---------------- Vetting ---------------- */}
      <section id="vetting" style={{ paddingBottom: 120, scrollMarginTop: 150 }}>
        <div className="wrap stack-lg" style={{ gap: 56 }}>
          <div className="vet-hero" style={c.vetPhoto ? { background: `linear-gradient(180deg, rgba(27,24,52,0.1), rgba(27,24,52,0.7)), url("${stripFocus(c.vetPhoto)}") ${c.vetPhoto.includes("#") ? focusPosition(c.vetPhoto) : "center"}/cover` } : undefined}>
            <h2>{c.vetTitle}</h2>
            {paragraphs(c.vetText).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
            {c.vetLink && (
              <p>
                <Link href="/senior-team" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 4 }}>{c.vetLink}</Link>
              </p>
            )}
          </div>
          <div className="grid-4">
            {c.vetItems.map((v, i) => (
              <div key={i} className="vet-item">
                <span className="icon-dot"><Icon d={VET_ICONS[i % VET_ICONS.length]} size={22} /></span>
                <h3 style={{ fontSize: 21, marginTop: 4 }}>{v.title}</h3>
                <p className="text-secondary" style={{ fontSize: 17 }}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Featured mentors ---------------- */}
      {mentors.length > 0 && (
        <section style={{ paddingBottom: 130 }}>
          <div className="wrap">
            <div className="between" style={{ alignItems: "flex-end", marginBottom: 40, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "clamp(34px, 4.4vw, 64px)" }}>{c.featuredTitle}</h2>
              {c.featuredLink && <Link href="/mentors" className="link" style={{ fontSize: 18 }}>{c.featuredLink}</Link>}
            </div>
            <div className="grid-4">
              {mentors.map((m) => {
                const firstService = m.packages[0]?.service;
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
                      {firstService && <span style={{ fontSize: 16 }}>{serviceLabel(firstService, m.packages[0]?.serviceOther)}</span>}
                      <span className="text-secondary" style={{ fontSize: 15 }}>
                        From <b style={{ color: "var(--ink)" }}>{money(m.minPrice)}</b>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Everything you need ---------------- */}
      <section style={{ paddingBottom: 140 }}>
        <div className="wrap">
          <h2 className="big-title" style={{ textAlign: "center", marginBottom: 64 }}>{c.featuresTitle}</h2>
          <HomeFeatures features={c.features.map((f) => ({ ...f, href: safeHref(f.href) }))} />
        </div>
      </section>

      {/* ---------------- Testimonials wall ---------------- */}
      {wall.length >= 3 && (
        <section id="reviews" className="wall" style={{ scrollMarginTop: 150 }}>
          <div className="wrap">
            <div className="center-head" style={{ marginBottom: 56, gap: 18 }}>
              <span className="eyebrow" style={{ color: "var(--ink)", fontSize: 18, fontWeight: 500 }}>{c.testimonialsEyebrow}</span>
              <h2 className="big-title">{c.testimonialsTitle}</h2>
            </div>
            <div className="wall-grid">
              {wall.map((t, i) => (
                <div key={t.key}>
                  <div className="testi">
                    <div className="row" style={{ gap: 14 }}>
                      <span className="avatar" style={{ width: 54, height: 54, background: ["#FCE4EC", "#E4EEFF", "#DDD5FF", "#F5B9CD"][i % 4] }}>
                        {initialsOf(t.name)}
                      </span>
                      <span className="stack-sm" style={{ gap: 2 }}>
                        <b style={{ fontSize: 18 }}>{t.name}</b>
                        <span className="text-secondary">{t.detail}</span>
                      </span>
                    </div>
                    <span className="stars">{"★".repeat(Math.round(t.rating))}</span>
                    {(paragraphs(t.quote).length ? paragraphs(t.quote) : [""]).map((q, j) => (
                      <p key={j} style={{ fontSize: 18, lineHeight: 1.55 }}>{q}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- FAQ (only once questions are added in Admin -> Website) ---------------- */}
      {c.faq.length > 0 && (
        <section id="faq" style={{ paddingBottom: 40, scrollMarginTop: 150 }}>
          <div className="wrap" style={{ maxWidth: 900 }}>
            <h2 className="big-title" style={{ textAlign: "center", marginBottom: 48 }}>{c.faqTitle}</h2>
            <div>
              {c.faq.map((q, i) => (
                <details key={i} className="collapse">
                  <summary style={{ fontSize: 18 }}>{q.question}</summary>
                  <div className="collapse-body">
                    {paragraphs(q.answer).map((a, j) => (
                      <p key={j} className="text-secondary" style={{ fontSize: 17, lineHeight: 1.6 }}>{a}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Final CTA ---------------- */}
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
