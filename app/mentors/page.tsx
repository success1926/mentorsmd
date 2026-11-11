import { Suspense } from "react";
import Link from "next/link";
import { BrowseFilters, SortSelect } from "@/components/BrowseFilters";
import { Icon, ICONS, Rating, tintFor, initialsOf } from "@/components/ui";
import { SchoolLogo, ClientSchools } from "@/components/SchoolLogo";
import { getSchoolLogos } from "@/lib/schoolLogos";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBrowseFilters, searchMentors, type BrowseFilters as Filters } from "@/lib/mentorQueries";
import { attributionFromCookieHeader } from "@/lib/activity";
import { logBrowseSearch } from "@/lib/searchLog";
import { getSiteContent } from "@/lib/siteContentStore";
import { WaitlistBox } from "@/components/WaitlistBox";
import { ALL_FILTER_GROUPS, MENTOR_QUICK_LINKS as QUICK, mentorRank, mentorStageTag, money, quickLinkHref } from "@/lib/options";

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
  const [mentors, c, logos] = await Promise.all([searchMentors(filters), getSiteContent("mentors"), getSchoolLogos()]);
  await logSearch(filters, mentors.length);
  const params = toParams(searchParams);

  // Active filter pills, each linking to the same URL minus that value.
  const pills: { label: string; href: string }[] = [];
  for (const g of ALL_FILTER_GROUPS) {
    for (const v of params.getAll(g.key)) {
      const label = g.options.find((o) => o.value === v)?.label;
      if (!label) continue;
      const next = new URLSearchParams(params.toString());
      const rest = next.getAll(g.key).filter((x) => x !== v);
      next.delete(g.key);
      rest.forEach((x) => next.append(g.key, x));
      pills.push({ label, href: `/mentors${next.toString() ? `?${next}` : ""}` });
    }
  }
  if (filters.q) {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    pills.unshift({ label: `"${filters.q}"`, href: `/mentors${next.toString() ? `?${next}` : ""}` });
  }
  // Any filter, search or quick link (sorting alone doesn't count).
  const anyFilter = [...params.keys()].some((k) => k !== "sort");
  const activeQuick = QUICK.find((q) => (q.qs ? params.toString() === q.qs : params.toString() === "" || params.toString().startsWith("sort=")))?.label;

  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <nav aria-label="Quick filters" className="wrap row" style={{ gap: 28, overflowX: "auto", height: 56, fontSize: 15 }}>
          {QUICK.map((q) => (
            <Link
              key={q.label}
              href={quickLinkHref(q)}
              className="nowrap"
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

      <div className="page" style={{ paddingTop: 40 }}>
        <section className="stack" style={{ gap: 14, marginBottom: 36 }}>
          {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
          <h1 className="page-title">{c.title}</h1>
          {c.intro && <p className="lede">{c.intro}</p>}
          <form action="/mentors" method="get" className="search-inline" role="search" style={{ maxWidth: 760 }}>
            <Icon d={ICONS.search} size={20} />
            <input name="q" defaultValue={filters.q} aria-label="Search mentors" placeholder="Search by name, school or keyword" />
            {/* keep the current filters when searching */}
            {Array.from(params.entries())
              .filter(([k]) => k !== "q")
              .map(([k, v], i) => (
                <input key={`${k}-${v}-${i}`} type="hidden" name={k} value={v} />
              ))}
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </section>

        <div className="browse">
          <aside aria-label="Filters" className="filters">
            <Suspense fallback={null}><BrowseFilters /></Suspense>
          </aside>

          <div className="stack" style={{ gap: 18 }}>
            <details className="filters-mobile collapse">
              <summary>Filters{pills.length ? ` (${pills.length})` : ""}</summary>
              <div className="collapse-body">
                <div className="filters">
                  <Suspense fallback={null}><BrowseFilters /></Suspense>
                </div>
              </div>
            </details>

            <div className="between" style={{ flexWrap: "wrap" }}>
              <b style={{ fontSize: 17 }}>
                {mentors.length} {mentors.length === 1 ? "mentor" : "mentors"}
              </b>
              <Suspense fallback={null}><SortSelect value={filters.sort} /></Suspense>
            </div>

            {pills.length > 0 && (
              <div className="row-wrap">
                {pills.map((p) => (
                  <Link key={p.href + p.label} href={p.href} className="filter-pill" aria-label={`Remove filter ${p.label}`} scroll={false}>
                    {p.label}
                    <span aria-hidden="true">×</span>
                  </Link>
                ))}
                <Link href={filters.sort !== "best" ? `/mentors?sort=${filters.sort}` : "/mentors"} className="link small" scroll={false}>
                  Clear all
                </Link>
              </div>
            )}

            {mentors.length === 0 && anyFilter && (
              <div className="empty stack" style={{ alignItems: "center" }}>
                <b style={{ color: "var(--ink)", fontSize: 18 }}>No mentors match those filters yet.</b>
                <span>Try removing a filter, or browse everyone.</span>
                <Link href="/mentors" className="btn btn-primary">Show all mentors</Link>
              </div>
            )}

            {mentors.length === 0 && !anyFilter && (
              <div className="empty stack" style={{ alignItems: "center" }}>
                <b style={{ color: "var(--ink)", fontSize: 18 }}>{c.emptyTitle}</b>
                {c.emptyText && <span>{c.emptyText}</span>}
                <div style={{ width: "100%", display: "flex", justifyContent: "center", margin: "8px 0" }}>
                  <WaitlistBox title={c.waitlistTitle} text={c.waitlistText} button={c.waitlistButton} success={c.waitlistSuccess} />
                </div>
                {c.emptyLink && <Link href="/become-a-mentor" className="link small">{c.emptyLink}</Link>}
              </div>
            )}

            {/* Leland-style cards (Nov 2026): photo, name, rating and rate;
                the one-line credential; rank and school with its logo;
                specialties; "Successful clients at" logos. */}
            {mentors.map((m) => {
              const rank = mentorRank(m.mentorStage) || mentorStageTag(m.mentorStage);
              return (
                <article key={m.id} className="mentor-card">
                  <Link href={`/mentors/${m.id}`} aria-hidden="true" tabIndex={-1}>
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt="" className="avatar" style={{ objectFit: "cover" }} loading="lazy" />
                    ) : (
                      <span className="avatar" style={{ background: tintFor(m.id) }}>{initialsOf(m.name)}</span>
                    )}
                  </Link>
                  <div className="stack" style={{ gap: 12, minWidth: 0 }}>
                    <div className="between" style={{ alignItems: "flex-start", gap: 12 }}>
                      <div className="stack-sm" style={{ gap: 4, minWidth: 0 }}>
                        <div className="row-wrap">
                          <Link href={`/mentors/${m.id}`} className="display" style={{ fontSize: 26 }}>{m.name}</Link>
                          {m.avgRating !== null && m.avgRating >= 4.8 && m.reviewCount >= 5 && <span className="badge badge-pink">Top rated</span>}
                        </div>
                        <Rating avg={m.avgRating} count={m.reviewCount} />
                      </div>
                      {m.fromRateCents && (
                        <Link href={`/mentors/${m.id}`} className="rate-chip nowrap">
                          {m.fromRateCents !== m.hourlyRateCents && <span className="text-muted small">from </span>}
                          <b>{money(m.fromRateCents)}</b>/hr
                        </Link>
                      )}
                    </div>
                    {m.credential && <span style={{ fontSize: 18, lineHeight: 1.4 }}>{m.credential}</span>}
                    {(m.medicalSchool || rank) && (
                      <span className="school-line text-secondary">
                        {m.medicalSchool && <SchoolLogo name={m.medicalSchool} logos={logos} size={28} title={false} />}
                        <span>{[rank, m.medicalSchool].filter(Boolean).join(" · ")}</span>
                      </span>
                    )}
                    {m.specialties.length > 0 && (
                      <div className="row-wrap" style={{ gap: 6 }}>
                        <span className="text-muted small" style={{ fontWeight: 600 }}>Specialties</span>
                        {m.specialties.slice(0, 5).map((t) => <span key={t} className="badge badge-brand">{t}</span>)}
                      </div>
                    )}
                    <ClientSchools schools={m.clientSchools} logos={logos} size={30} max={8} />
                    <div className="row-wrap" style={{ marginTop: 4, gap: 10 }}>
                      <Link href={`/mentors/${m.id}`} className="btn btn-primary">Free intro call</Link>
                      <Link href={`/mentors/${m.id}`} className="btn">View profile</Link>
                      {m.totalPackages > 0 && (
                        <span className="text-muted small">
                          {m.totalPackages} {m.totalPackages === 1 ? "package" : "packages"} · hour bundles
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
