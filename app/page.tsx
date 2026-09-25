import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "@/components/SearchBar";
import { TrustpilotWidget } from "@/components/TrustpilotWidget";
import { FAQ } from "@/components/FAQ";
import { StudentSpotlight } from "@/components/StudentSpotlight";
import { Testimonials } from "@/components/Testimonials";
import { getFeaturedCoaches, CoachCard, VerifiedIcon } from "@/components/MentorSpotlight";
import { ScrollGrow } from "@/components/ScrollGrow";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic"; // coach cards and counts read live data

const SERVICES = [
  { category: "ESSAY_REVIEW", title: "Essays", desc: "Personal statements and secondaries, from brainstorm to final line edits." },
  { category: "MOCK_INTERVIEW", title: "Mock interviews", desc: "MMI and traditional formats over video, with honest feedback after." },
  { category: "APPLICATION_STRATEGY", title: "Application strategy", desc: "School list, timeline, activities, and whether to apply this cycle." },
  { category: "TUTORING", title: "Tutoring", desc: "MCAT and coursework help from people who scored where you want to be." },
];

const CHIPS = [
  { label: "Personal statement", href: "/coaches?q=personal%20statement" },
  { label: "Secondaries", href: "/coaches?q=secondar" },
  { label: "Mock interview", href: "/coaches?category=MOCK_INTERVIEW" },
  { label: "Application strategy", href: "/coaches?category=APPLICATION_STRATEGY" },
  { label: "MCAT", href: "/coaches?q=MCAT" },
];

const STEPS = [
  { title: "Message a coach", desc: "Ask questions for free. Booking unlocks once your coach replies, so you know they can help on your timeline.", tag: "Free", tagClass: "badge-brand" },
  { title: "Pick a due date & pay", desc: "Your payment is held by MentorsMD, not sent to the coach yet.", tag: "Held safely", tagClass: "badge-warning" },
  { title: "Get your work back", desc: "Your coach delivers. You have 96 hours to review, ask for a revision, or raise an issue.", tag: "96h review", tagClass: "badge-brand" },
  { title: "Release payment", desc: "Happy? Release it and your coach gets paid. Then leave a review for the next student.", tag: "Coach paid", tagClass: "badge-success" },
];

export default async function HomePage() {
  const [featured, coachCount, reviewStats, categoryRows] = await Promise.all([
    getFeaturedCoaches(3),
    prisma.user.count({ where: { role: "SELLER", gigs: { some: { active: true } } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.gig.findMany({ where: { active: true }, select: { category: true, sellerId: true }, distinct: ["category", "sellerId"] }),
  ]);

  const coachesPerCategory: Record<string, number> = {};
  for (const row of categoryRows) coachesPerCategory[row.category] = (coachesPerCategory[row.category] || 0) + 1;

  const reviewCount = reviewStats._count._all;
  const avgRating = reviewStats._avg.rating;
  const heroCoach = featured[0];

  return (
    // .bleed lets the homepage use the full browser width; the negative
    // margins cancel the narrow page container's padding.
    <div className="bleed" style={{ marginTop: -32, marginBottom: -80 }}>
      {/* ---------------- Hero ---------------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <span className="pill">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Every coach is a verified med student or resident
            </span>
            <h1 className="hero-title">
              Get into med school with someone who <em>just did.</em>
            </h1>
            <p className="hero-sub">
              One-on-one help with personal statements, secondaries and interviews. Message a coach first, and only pay once you're happy with the work.
            </p>
            <SearchBar target="/coaches" large placeholder="Search by school, specialty, or service" buttonLabel="Find a coach" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {CHIPS.map((c) => (
                <Link key={c.label} href={c.href} className="chip">{c.label}</Link>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div style={{ position: "absolute", top: 0, right: 0, width: "88%", height: 420, borderRadius: 28, background: "var(--tint)" }} />
            <div style={{ position: "absolute", top: 20, right: "30%", width: 110, height: 110, borderRadius: "50%", background: "var(--accent)", opacity: 0.7 }} />
            {heroCoach && (
              <div className="card" style={{ position: "absolute", top: 64, left: 0, width: "78%", boxShadow: "0 20px 48px rgba(27,24,52,0.12)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <Avatar name={heroCoach.name} photoUrl={heroCoach.photoUrl} style={{ width: 60, height: 60, fontSize: 22 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="display" style={{ fontSize: 21 }}>{heroCoach.name}</span>
                      <VerifiedIcon />
                    </div>
                    {heroCoach.credential && <div className="text-secondary">{heroCoach.credential}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontSize: 15 }}>
                    {heroCoach.avgRating !== null ? (
                      <><span className="stars">★</span> <b>{heroCoach.avgRating.toFixed(1)}</b> <span className="text-secondary">({heroCoach.reviewCount})</span></>
                    ) : (
                      <span className="badge badge-brand">New coach</span>
                    )}
                  </span>
                  {heroCoach.minPrice !== null && (
                    <span className="text-secondary" style={{ fontSize: 15 }}>from <b style={{ fontSize: 19, color: "var(--ink)" }}>${(heroCoach.minPrice / 100).toFixed(0)}</b></span>
                  )}
                </div>
              </div>
            )}
            <div style={{ position: "absolute", bottom: 20, right: 8, width: 290, background: "var(--ink)", color: "#fff", borderRadius: 18, padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 16px 40px rgba(27,24,52,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" />
                </svg>
                Payment held by MentorsMD
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.15)" }}>
                <div style={{ width: "66%", height: "100%", borderRadius: 3, background: "var(--accent)" }} />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "rgba(255,255,255,0.75)" }}>
                Work delivered. You have 96 hours to review or ask for a revision.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Trust strip (real numbers only) ---------------- */}
      <section className="stat-strip">
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            {coachCount > 0 && (
              <div><div className="stat-num">{coachCount}</div><div className="text-secondary">verified coaches</div></div>
            )}
            {reviewCount >= 3 && avgRating !== null && (
              <div><div className="stat-num">{avgRating.toFixed(1)} <span className="stars">★</span></div><div className="text-secondary">from {reviewCount} reviews</div></div>
            )}
            <div><div className="stat-num">100%</div><div className="text-secondary">coaches invited &amp; vetted</div></div>
          </div>
          <div style={{ minWidth: 260 }}>
            <TrustpilotWidget />
          </div>
        </div>
      </section>

      {/* ---------------- Services ---------------- */}
      <section className="section">
        <div className="wrap">
          <div className="section-head">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="eyebrow">Services</span>
              <h2 className="section-title">Help for every stage of the cycle</h2>
            </div>
            <Link href="/coaches" style={{ fontWeight: 600, color: "var(--primary-deep)" }}>Browse all coaches →</Link>
          </div>
          <ScrollGrow from={0.94}>
            <div className="grid-4">
              {SERVICES.map((s, i) => (
                <Link key={s.category} href={`/coaches?category=${s.category}`} className="card service-card">
                  <div className="service-num">{i + 1}</div>
                  <div style={{ fontSize: 19, fontWeight: 600 }}>{s.title}</div>
                  <div className="text-secondary" style={{ fontSize: 15, lineHeight: 1.5, flex: 1 }}>{s.desc}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--primary-deep)" }}>
                    {coachesPerCategory[s.category]
                      ? `${coachesPerCategory[s.category]} coach${coachesPerCategory[s.category] === 1 ? "" : "es"} →`
                      : "See coaches →"}
                  </div>
                </Link>
              ))}
            </div>
          </ScrollGrow>
        </div>
      </section>

      {/* ---------------- Featured coaches ---------------- */}
      {featured.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="eyebrow">Featured coaches</span>
                <h2 className="section-title">They were in your seat a year or two ago</h2>
              </div>
              <Link href="/coaches" className="btn">View all coaches</Link>
            </div>
            <ScrollGrow from={0.92}>
              <div className="grid-3">
                {featured.map((c, i) => (
                  <CoachCard key={c.id} coach={c} index={i} />
                ))}
              </div>
            </ScrollGrow>
          </div>
        </section>
      )}

      {/* ---------------- How it works (the escrow story) ---------------- */}
      <section id="how" style={{ padding: "0 16px", scrollMarginTop: 80 }}>
        <ScrollGrow from={0.86}>
          <div className="how-panel wrap" style={{ maxWidth: 1360 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, marginBottom: 44 }}>
              <span className="eyebrow" style={{ color: "var(--primary-deep)" }}>How it works</span>
              <h2 className="section-title" style={{ maxWidth: 780 }}>You only pay when you're happy with the work</h2>
              <p className="hero-sub" style={{ fontSize: 18 }}>
                Your payment sits safely with MentorsMD until you approve. No guessing whether a coach is a good fit: you talk first.
              </p>
            </div>
            <div className="grid-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="step-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="step-num">{i + 1}</div>
                    <span className={`badge ${s.tagClass}`} style={{ borderRadius: 999 }}>{s.tag}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{s.title}</div>
                  <div className="text-secondary" style={{ fontSize: 15, lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </ScrollGrow>
      </section>

      {/* ---------------- Student outcomes + testimonials ---------------- */}
      <section className="section">
        <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 56 }}>
          <ScrollGrow from={0.94}>
            <StudentSpotlight />
          </ScrollGrow>
          <ScrollGrow from={0.94}>
            <Testimonials />
          </ScrollGrow>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section style={{ padding: "0 16px" }}>
        <ScrollGrow from={0.88}>
          <div className="cta-band wrap" style={{ maxWidth: 1360 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="section-title" style={{ maxWidth: 700 }}>
                Your application deserves a <em>second set of eyes.</em>
              </h2>
              <p style={{ margin: 0, fontSize: 18, color: "rgba(255,255,255,0.72)" }}>
                Message any coach for free. Book only when it feels right.
              </p>
            </div>
            <Link href="/coaches" className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)", border: "none" }}>
              Find your coach
            </Link>
          </div>
        </ScrollGrow>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <FAQ />
        </div>
      </section>
    </div>
  );
}
