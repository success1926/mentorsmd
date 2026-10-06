import { Suspense } from "react";
import Link from "next/link";
import { BrowseFilters, SortSelect } from "@/components/BrowseFilters";
import { Icon, ICONS, Vetted, Rating, tintFor, initialsOf } from "@/components/ui";
import { parseBrowseFilters, searchMentors } from "@/lib/mentorQueries";
import { BACKGROUNDS, FILTER_GROUPS, FORMATS, SCHOOL_TYPES, STAGES, TURNAROUNDS, labelFor, money, serviceLabel } from "@/lib/options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find your mentor · MentorsMD" };

type SP = Record<string, string | string[] | undefined>;

// Quick links set a filter (and clear the others).
const QUICK = [
  { label: "Popular", qs: "" },
  { label: "Personal statement", qs: "service=PERSONAL_STATEMENT" },
  { label: "Secondaries", qs: "service=SECONDARIES" },
  { label: "MMI", qs: "service=MMI" },
  { label: "Traditional interviews", qs: "service=TRADITIONAL_INTERVIEW" },
  { label: "MCAT", qs: "service=MCAT" },
  { label: "School list", qs: "service=SCHOOL_LIST" },
  { label: "Reapplicants", qs: "bg=REAPPLICANT" },
  { label: "Non-traditional", qs: "bg=NON_TRADITIONAL" },
  { label: "DO schools", qs: "school=DO" },
  { label: "MD/PhD", qs: "school=MD_PHD" },
  { label: "Gap years", qs: "bg=GAP_YEARS" },
];

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
  const mentors = await searchMentors(filters);
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
  const pkgFiltered = filters.service.length + filters.format.length + filters.turnaround.length + filters.price.length > 0;
  const activeQuick = QUICK.find((q) => (q.qs ? params.toString() === q.qs : params.toString() === "" || params.toString().startsWith("sort=")))?.label;

  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <nav aria-label="Quick filters" className="wrap row" style={{ gap: 28, overflowX: "auto", height: 56, fontSize: 15 }}>
          {QUICK.map((q) => (
            <Link
              key={q.label}
              href={q.qs ? `/mentors?${q.qs}` : "/mentors"}
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
          <h1 className="page-title">Find your mentor</h1>
          <p className="lede">Every mentor is vetted by our senior team. Message anyone for free.</p>
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

            {mentors.length === 0 && (
              <div className="empty stack" style={{ alignItems: "center" }}>
                <b style={{ color: "var(--ink)", fontSize: 18 }}>No mentors match those filters yet.</b>
                <span>Try removing a filter, or browse everyone.</span>
                <Link href="/mentors" className="btn btn-primary">Show all mentors</Link>
              </div>
            )}

            {mentors.map((m) => {
              const tags = [labelFor(STAGES, m.mentorStage), labelFor(SCHOOL_TYPES, m.schoolType), ...m.backgrounds.map((b) => labelFor(BACKGROUNDS, b))].filter(Boolean);
              const head = pkgFiltered
                ? `${m.packages.length} ${m.packages.length === 1 ? "package matches" : "packages match"}`
                : `${m.totalPackages} ${m.totalPackages === 1 ? "package" : "packages"}`;
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
                    {m.credential && <span className="text-secondary">{m.credential}</span>}
                    {m.bio && (
                      <p style={{ fontSize: 16, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {m.bio}
                      </p>
                    )}
                    {tags.length > 0 && (
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {tags.map((t) => <span key={t} className="badge">{t}</span>)}
                      </div>
                    )}
                    <div className="stack-sm" style={{ marginTop: 4 }}>
                      <span className="text-muted" style={{ fontWeight: 600 }}>{head}</span>
                      {m.packages.slice(0, 4).map((p) => (
                        <Link key={p.id} href={`/mentors/${m.id}#pkg-${p.id}`} className="pkg-line">
                          <span className="stack-sm" style={{ gap: 2, minWidth: 0 }}>
                            <b style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</b>
                            <span className="text-muted">
                              {[serviceLabel(p.service, p.serviceOther), labelFor(FORMATS, p.format), labelFor(TURNAROUNDS, p.turnaround)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <b className="nowrap">{money(p.price)}</b>
                        </Link>
                      ))}
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
