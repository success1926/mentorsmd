import { Suspense } from "react";
import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { getSchoolLogos } from "@/lib/schoolLogos";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBrowseFilters, searchMentors, type BrowseFilters as Filters } from "@/lib/mentorQueries";
import { attributionFromCookieHeader } from "@/lib/activity";
import { logBrowseSearch } from "@/lib/searchLog";
import { getSiteContent } from "@/lib/siteContentStore";
import { WaitlistBox } from "@/components/WaitlistBox";
import { GuidedBrowse, type BrowseMentor } from "@/components/GuidedBrowse";
import { matchMentor } from "@/lib/guidedMatch";
import { MENTOR_QUICK_LINKS as QUICK, quickLinkHref } from "@/lib/options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find Your Mentor", description: "Browse vetted medical school admissions mentors by specialty, who they help most and price: personal statements, secondaries, MMI and interview prep, MCAT and more." };

type SP = Record<string, string | string[] | undefined>;

// Student demand (#82): every search or filter is logged (lib/searchLog.ts).
async function logSearch(f: Filters, resultCount: number) {
  try {
    const h = headers();
    const session = await getServerSession(authOptions);
    const { visitorId } = attributionFromCookieHeader(h.get("cookie"));
    logBrowseSearch(f, resultCount, { userId: (session?.user as any)?.id, role: (session?.user as any)?.role, visitorId, userAgent: h.get("user-agent") });
  } catch (err) {
    console.error("Couldn't log the search:", err);
  }
}

function toParams(sp: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else if (v) p.set(k, v);
  }
  return p;
}

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const filters = parseBrowseFilters(searchParams);
  // Guided match (Nov 2026, components/GuidedBrowse.tsx): Best for,
  // Specialties and Price are ranked in the browser, so they aren't used to
  // narrow the list here. The search box and link-only filters (format,
  // stage, school type, rating) still narrow it on the server.
  const [mentors, c, logos] = await Promise.all([searchMentors({ ...filters, best: [], service: [], price: [] }), getSiteContent("mentors"), getSchoolLogos()]);
  const picks = { best: filters.best, service: filters.service, price: filters.price };
  const fullMatches = mentors.filter((m) => matchMentor(m, picks).full).length;
  await logSearch(filters, fullMatches);
  const params = toParams(searchParams);
  const browse: BrowseMentor[] = mentors.map((m) => ({
    id: m.id,
    name: m.name,
    credential: m.credential,
    medicalSchool: m.medicalSchool,
    photoUrl: m.photoUrl,
    mentorStage: m.mentorStage,
    bestFor: m.bestFor,
    strongestStages: m.strongestStages,
    packageServices: m.packageServices,
    offerPrices: m.offerPrices,
    specialties: m.specialties,
    clientSchools: m.clientSchools,
    avgRating: m.avgRating,
    reviewCount: m.reviewCount,
    hourlyRateCents: m.hourlyRateCents,
    fromRateCents: m.fromRateCents,
    totalPackages: m.totalPackages,
    createdAt: m.createdAt.getTime(),
    knownFor: m.knownFor,
    roleTitles: m.roleTitles,
    languages: m.languages,
  }));
  const nothingListed = mentors.length === 0 && !filters.q && ![...params.keys()].some((k) => !["sort", "best", "service", "price"].includes(k));
  const activeQuick = QUICK.find((q) => (q.qs ? params.toString() === q.qs : params.toString() === "" || params.toString().startsWith("sort=")))?.label;

  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--line)", background: "#fff" }}>
        <nav aria-label="Quick filters" className="wrap row" style={{ gap: 28, overflowX: "auto", height: 56, fontSize: 15 }}>
          {QUICK.map((q) => (
            <Link
              key={q.label}
              href={quickLinkHref(q)}
              className="nowrap"
              scroll={false}
              style={{
                padding: "16px 0",
                borderBottom: `2px solid ${activeQuick === q.label ? "var(--primary)" : "transparent"}`,
                fontWeight: activeQuick === q.label ? 600 : 400,
              }}
            >
              {q.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Same gradient and blobs as the homepage hero. */}
      <section className="browse-hero">
        <div className="blob" style={{ left: -120, top: "52%", width: 520, height: 260, background: "rgba(228,238,255,0.9)", filter: "blur(50px)" }} />
        <div className="blob" style={{ right: -80, top: "30%", width: 560, height: 300, background: "rgba(245,185,205,0.45)", filter: "blur(60px)" }} />
        <div className="blob" style={{ left: "35%", top: 10, width: 520, height: 200, background: "rgba(207,196,255,0.45)", filter: "blur(60px)" }} />
        <div className="browse-hero-in">
          <div className="stack" style={{ gap: 14, minWidth: 0 }}>
            {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
            <h1 className="page-title browse-title">{c.title}</h1>
            {c.intro && <p className="lede">{c.intro}</p>}
          </div>
          <form action="/mentors" method="get" className="search-inline" role="search">
            <Icon d={ICONS.search} size={20} />
            <input name="q" defaultValue={filters.q} aria-label="Search mentors" placeholder="Search by name, school or keyword" />
            {/* keep the current picks when searching */}
            {Array.from(params.entries())
              .filter(([k]) => k !== "q")
              .map(([k, v], i) => (
                <input key={`${k}-${v}-${i}`} type="hidden" name={k} value={v} />
              ))}
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      <div className="browse-body">
        <div className="page" style={{ paddingTop: 8 }}>
          {filters.q && (
            <div className="row-wrap" style={{ marginBottom: 16 }}>
              <span className="text-secondary">Results for &ldquo;{filters.q}&rdquo;</span>
              <Link href={(() => { const n = new URLSearchParams(params.toString()); n.delete("q"); return `/mentors${n.toString() ? `?${n}` : ""}`; })()} className="link small" scroll={false}>
                Clear search
              </Link>
            </div>
          )}
          {nothingListed ? (
            <div className="empty stack" style={{ alignItems: "center" }}>
              <b style={{ color: "var(--ink)", fontSize: 18 }}>{c.emptyTitle}</b>
              {c.emptyText && <span>{c.emptyText}</span>}
              <div style={{ width: "100%", display: "flex", justifyContent: "center", margin: "8px 0" }}>
                <WaitlistBox title={c.waitlistTitle} text={c.waitlistText} button={c.waitlistButton} success={c.waitlistSuccess} />
              </div>
              {c.emptyLink && <Link href="/become-a-mentor" className="link small">{c.emptyLink}</Link>}
            </div>
          ) : (
            <Suspense fallback={null}>
              <GuidedBrowse mentors={browse} logos={logos} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
