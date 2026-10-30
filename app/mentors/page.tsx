import { Suspense } from "react";
import Link from "next/link";
import { BrowseFilters, SortSelect } from "@/components/BrowseFilters";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseBrowseFilters, searchMentors, type BrowseFilters as Filters } from "@/lib/mentorQueries";
import { attributionFromCookieHeader, isBotUserAgent, recordActivity } from "@/lib/activity";
import { runAfterResponse } from "@/lib/request";
import { getSiteContent } from "@/lib/siteContentStore";
import { WaitlistBox } from "@/components/WaitlistBox";
import { BEST_FOR, FILTER_GROUPS, FORMATS, MENTOR_QUICK_LINKS as QUICK, SCHOOL_TYPES, STAGES, labelFor, money, quickLinkHref } from "@/lib/options";
import { hoursLabel } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find Your Mentor", description: "Browse vetted medical school admissions mentors by service, school and price: personal statements, secondaries, MMI and interview prep, MCAT and more." };

type SP = Record<string, string | string[] | undefined>;

// Student demand (#82): every search or filter on this page goes into the
// private activity log, with how many mentors matched. Sorting alone,
// bots, mentors and admins aren't logged.
async function logSearch(f: Filters, resultCount: number) {
  const picked: Record<string, string[]> = {};
  for (const k of ["service", "format", "price", "stage", "school", "best"] as const) {
    if (f[k].length) picked[k] = [...f[k]].sort();
  }
  if (f.rating !== null) picked.rating = [String(f.rating)];
  if (!f.q && Object.keys(picked).length === 0) return;
  try {
    const h = headers();
    if (isBotUserAgent(h.get("user-agent"))) return;
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (role && role !== "BUYER") return;
    const { visitorId } = attributionFromCookieHeader(h.get("cookie"));
    const userId = (session?.user as any)?.id || null;
    // A first-time visitor has no visitor id yet: still logged (just not
    // de-duplicated). Written after the page is sent, so it never slows it down.
    runAfterResponse(() => recordActivity({ kind: "SEARCH", visitorId, userId, query: f.q ? f.q.toLowerCase() : null, filters: picked, resultCount }));
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
  const [mentors, c] = await Promise.all([searchMentors(filters), getSiteContent("mentors")]);
  await logSearch(filters, mentors.length);
  const params = toParams(searchParams);

  // Active filter pills, each linking to the same URL minus that value.
  const pills: { label: string; href: string }[] = [];
  for (const g of FILTER_GROUPS) {
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

            {mentors.map((m) => {
              const tags = [labelFor(STAGES, m.mentorStage), labelFor(SCHOOL_TYPES, m.schoolType)].filter(Boolean);
              const bestFor = m.bestFor.map((b) => labelFor(BEST_FOR, b));
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
                  <div className="stack" style={{ gap: 10, minWidth: 0 }}>
                    <div className="row-wrap">
                      <Link href={`/mentors/${m.id}`} className="display" style={{ fontSize: 26 }}>{m.name}</Link>
                      <Vetted />
                      {m.avgRating !== null && m.avgRating >= 4.8 && m.reviewCount >= 5 && <span className="badge badge-pink">Top rated</span>}
                      <span style={{ marginLeft: "auto" }}><Rating avg={m.avgRating} count={m.reviewCount} /></span>
                    </div>
                    {(m.credential || m.medicalSchool) && <span className="text-secondary">{[m.credential, m.medicalSchool].filter(Boolean).join(" · ")}</span>}
                    {m.bio && (
                      <p style={{ fontSize: 16, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {m.bio}
                      </p>
                    )}
                    {(tags.length > 0 || bestFor.length > 0) && (
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {tags.map((t) => <span key={t} className="badge">{t}</span>)}
                        {bestFor.slice(0, 4).map((t) => <span key={t} className="badge badge-brand">{t}</span>)}
                      </div>
                    )}
                    <div className="between" style={{ marginTop: 4, gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                        {m.totalPackages > 0 ? (
                          <>
                            <span className="text-muted" style={{ fontWeight: 600 }}>
                              {m.totalPackages} {m.totalPackages === 1 ? "package" : "packages"}
                            </span>
                            {m.packages.slice(0, 3).map((p) => (
                              <Link key={p.id} href={`/mentors/${m.id}?package=${p.id}`} className="text-secondary" style={{ fontSize: 15 }}>
                                {p.title}
                                <span className="text-muted">{[p.minutes ? ` · about ${hoursLabel(p.minutes)}` : "", p.format ? ` · ${labelFor(FORMATS, p.format)}` : ""].join("")}</span>
                              </Link>
                            ))}
                          </>
                        ) : (
                          <span className="text-muted">Hourly help · free 15-min intro call</span>
                        )}
                      </div>
                      {m.fromRateCents && (
                        <Link href={`/mentors/${m.id}`} className="nowrap" style={{ fontSize: 15 }}>
                          from <b className="display" style={{ fontSize: 26 }}>{money(m.fromRateCents)}</b>/hr
                        </Link>
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
