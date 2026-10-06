import Link from "next/link";
import { HomeFeatures } from "@/components/HomeFeatures";
import { RoleCta } from "@/components/RoleCta";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { getFeaturedMentors, getReviewStats, getWallReviews } from "@/lib/mentorQueries";
import { MENTOR_ACCEPTANCE_RATE, MENTOR_SCHOOLS, PHOTOS, TESTIMONIALS } from "@/lib/content";
import { labelFor, money, STAGES, serviceLabel } from "@/lib/options";

export const dynamic = "force-dynamic"; // mentor cards and review counts read live data

const QUICK = [
  { label: "Personal statement", icon: ICONS.pen, href: "/mentors?service=PERSONAL_STATEMENT" },
  { label: "Secondaries", icon: ICONS.doc, href: "/mentors?service=SECONDARIES" },
  { label: "Interviews", icon: ICONS.chat, href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW" },
  { label: "MCAT", icon: ICONS.chart, href: "/mentors?service=MCAT" },
  { label: "Reapplying", icon: ICONS.cycle, href: "/mentors?service=REAPPLICANT&bg=REAPPLICANT" },
];

const PATHS = [
  {
    title: "Write a standout application",
    body: "Personal statement, activities and secondaries, shaped by someone who just wrote theirs.",
    bg: "linear-gradient(180deg, #CFC4FF 0%, #8E78F0 50%, #2B1F6B 100%)",
    photo: PHOTOS.pathApplication,
    href: "/mentors?service=PERSONAL_STATEMENT&service=SECONDARIES&service=ACTIVITIES",
  },
  {
    title: "Ace your interviews",
    body: "MMI and traditional mock interviews with written feedback after every session.",
    bg: "linear-gradient(180deg, #F5B9CD 0%, #9A7BE8 50%, #2B1F6B 100%)",
    photo: PHOTOS.pathInterviews,
    href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW",
  },
  {
    title: "Plan your path",
    body: "School lists, MCAT strategy, gap years and reapplying, from people who made the same calls.",
    bg: "linear-gradient(180deg, #E4EEFF 0%, #8E9BF0 50%, #2B1F6B 100%)",
    photo: PHOTOS.pathPlan,
    href: "/mentors?service=SCHOOL_LIST&service=MCAT&service=REAPPLICANT",
  },
];

const VET = [
  { title: "Verified", body: "Every mentor is confirmed as a current med student or resident.", icon: ICONS.shield },
  { title: "Reviewed", body: "Our senior team looks at their own application and admissions experience.", icon: ICONS.doc },
  { title: "Approved", body: "Only mentors with real expertise in what they offer are accepted.", icon: ICONS.check },
  ...(MENTOR_ACCEPTANCE_RATE !== null
    ? [{ title: "Selective", body: `Only ${MENTOR_ACCEPTANCE_RATE}% of people who apply to mentor are accepted.`, icon: ICONS.star }]
    : [{ title: "Invite-only", body: "Nobody can sign up to mentor. Every mentor joins through an invite from our team.", icon: ICONS.star }]),
];

export default async function HomePage() {
  const [mentors, stats, reviews] = await Promise.all([getFeaturedMentors(4), getReviewStats(), getWallReviews(8)]);

  const wall = [
    ...TESTIMONIALS.map((t) => ({ key: `t-${t.name}`, name: t.name, detail: t.detail, quote: t.quote, rating: t.rating ?? 5 })),
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
          <h1 className="hero-title">Your white coat starts here</h1>
          <p className="hero-sub">One-on-one help from med students and residents, every one vetted by our senior team.</p>
          <form action="/mentors" method="get" className="hero-search" role="search">
            <Icon d={ICONS.search} size={22} />
            <input name="q" aria-label="Search for help" placeholder="Search for help with your personal statement, MMI, MCAT…" />
            <button type="submit" aria-label="Search mentors">
              <Icon d={ICONS.arrow} size={22} />
            </button>
          </form>
          <div className="row-wrap" style={{ justifyContent: "center", gap: 10 }}>
            {QUICK.map((c) => (
              <Link key={c.label} href={c.href} className="chip">
                <Icon d={c.icon} size={17} />
                {c.label}
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

        {MENTOR_SCHOOLS.length > 0 && (
          <div className="school-strip">
            <span>Our mentors study at</span>
            {MENTOR_SCHOOLS.map((s) => (
              <b key={s}>{s}</b>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Three paths ---------------- */}
      <section className="home-section">
        <div className="wrap">
          <div className="center-head">
            <h2 className="big-title">
              Getting into med school is hard.
              <br />
              You don&apos;t have to do it alone.
            </h2>
            <p className="lede" style={{ maxWidth: 880, fontSize: 21 }}>
              The process is long, competitive and hard to read from the outside. MentorsMD pairs you with people who got in recently and know what works now.
            </p>
          </div>
          <div className="grid-3" style={{ marginTop: 56 }}>
            {PATHS.map((p) => (
              <div key={p.title} className="path-card" style={{ background: p.bg }}>
                {p.photo && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="path-photo" src={p.photo} alt="" />
                    <div className="path-shade" />
                  </>
                )}
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <Link href={p.href} className="btn">Find a mentor</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Vetting ---------------- */}
      <section id="vetting" style={{ paddingBottom: 120, scrollMarginTop: 100 }}>
        <div className="wrap stack-lg" style={{ gap: 56 }}>
          <div className="vet-hero" style={PHOTOS.vetting ? { background: `linear-gradient(180deg, rgba(27,24,52,0.1), rgba(27,24,52,0.7)), url(${PHOTOS.vetting}) center/cover` } : undefined}>
            <h2>Every mentor, vetted.</h2>
            <p>
              Anyone can call themselves an admissions coach. On MentorsMD, nobody mentors until our senior team has reviewed their background and admissions experience. Only people with real expertise get through.
            </p>
          </div>
          <div className="grid-4">
            {VET.map((v) => (
              <div key={v.title} className="vet-item">
                <span className="icon-dot"><Icon d={v.icon} size={22} /></span>
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
              <h2 style={{ fontSize: "clamp(34px, 4.4vw, 64px)" }}>Meet a few of our mentors.</h2>
              <Link href="/mentors" className="link" style={{ fontSize: 18 }}>Browse all mentors →</Link>
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
          <h2 className="big-title" style={{ textAlign: "center", marginBottom: 64 }}>Everything you need to get in.</h2>
          <HomeFeatures />
        </div>
      </section>

      {/* ---------------- Testimonials wall ---------------- */}
      {wall.length >= 3 && (
        <section id="reviews" className="wall" style={{ scrollMarginTop: 80 }}>
          <div className="wrap">
            <div className="center-head" style={{ marginBottom: 56, gap: 18 }}>
              <span className="eyebrow" style={{ color: "var(--ink)", fontSize: 18, fontWeight: 500 }}>Testimonials</span>
              <h2 className="big-title">Don&apos;t just take our word for it.</h2>
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
                    <p style={{ fontSize: 18, lineHeight: 1.55 }}>{t.quote}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Final CTA ---------------- */}
      <section className="home-section">
        <div className="wrap center-head" style={{ gap: 24 }}>
          <h2 className="big-title">Ready when you are.</h2>
          <p className="lede" style={{ fontSize: 21 }}>
            Message any vetted mentor for free. When you book, we hold your payment until you approve the work.
          </p>
          <RoleCta href="/mentors" label="Get started" className="btn btn-primary btn-lg" style={{ padding: "20px 38px", fontSize: 19 }} />
        </div>
      </section>
    </div>
  );
}
