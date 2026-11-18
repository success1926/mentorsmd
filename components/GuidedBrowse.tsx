"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Rating, tintFor, initialsOf } from "@/components/ui";
import { SchoolLogo, ClientSchools } from "@/components/SchoolLogo";
import { CompareToggle, CompareTray, compareSnapshot, useCompare } from "@/components/Compare";
import type { LogoMap } from "@/lib/schoolLogoKey";
import { BEST_FOR, SERVICES, credentialLine, labelFor, mentorRank, mentorStageTag, money } from "@/lib/options";
import { GUIDED_GROUPS, matchMentor, optionCount, pickCount, pickLabel, picksFrom, type GuidedKey, type MatchResult, type MatchableMentor, type Picks } from "@/lib/guidedMatch";

// Browse with guided match + compare (Nov 2026). The page (app/mentors/
// page.tsx) loads every listed mentor that passes the search box and any
// link-only filters; this component ranks them by the student's picks in
// the browser, so each tap is instant. Picks and sort are kept in the URL
// (?best=&service=&price=&sort=), so links, quick links and Back still work,
// and every change is still logged as a search by the page.

export type BrowseMentor = MatchableMentor & {
  id: string;
  name: string;
  credential: string | null;
  medicalSchool: string | null;
  photoUrl: string | null;
  mentorStage: string | null;
  specialties: string[];
  clientSchools: string[];
  avgRating: number | null;
  reviewCount: number;
  hourlyRateCents: number | null;
  fromRateCents: number | null;
  totalPackages: number;
  createdAt: number;
  knownFor: string | null;
  roleTitles: string[];
  languages: string[];
};

const SORTS = [
  { value: "best", label: "Best match" },
  { value: "rated", label: "Highest rated" },
  { value: "low", label: "Price: low to high" },
  { value: "high", label: "Price: high to low" },
  { value: "new", label: "Newest" },
];

function snapshot(m: BrowseMentor) {
  return compareSnapshot({ ...m, school: m.medicalSchool, packageCount: m.totalPackages, roleTypes: m.roleTitles });
}

export function GuidedBrowse({ mentors, logos }: { mentors: BrowseMentor[]; logos: LogoMap }) {
  const router = useRouter();
  const pathname = usePathname() || "/mentors";
  const params = useSearchParams();
  const urlPicks = useMemo(() => picksFrom(params ?? new URLSearchParams()), [params]);
  const [picks, setPicks] = useState<Picks>(urlPicks);
  const [sort, setSort] = useState(params?.get("sort") || "best");
  const [guideOpen, setGuideOpen] = useState(false);
  const compare = useCompare();

  // Back / forward and quick links change the URL: follow it.
  useEffect(() => {
    setPicks(urlPicks);
    setSort(params?.get("sort") || "best");
  }, [urlPicks, params]);

  // Keep compared mentors' stored details current.
  useEffect(() => {
    for (const m of mentors) if (compare.has(m.id)) compare.refresh(snapshot(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentors]);

  function push(next: Picks, nextSort: string) {
    const p = new URLSearchParams(params?.toString() || "");
    for (const g of GUIDED_GROUPS) {
      p.delete(g.key);
      next[g.key].forEach((v) => p.append(g.key, v));
    }
    if (nextSort === "best") p.delete("sort");
    else p.set("sort", nextSort);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  function toggle(key: GuidedKey, value: string) {
    const cur = picks[key];
    const next = { ...picks, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    setPicks(next);
    push(next, sort);
  }
  function clearAll() {
    const next = { best: [], service: [], price: [] };
    setPicks(next);
    push(next, sort);
  }
  function changeSort(v: string) {
    setSort(v);
    push(picks, v);
  }

  const n = pickCount(picks);
  const rateOf = (m: BrowseMentor) => m.fromRateCents ?? Number.MAX_SAFE_INTEGER;
  const scored = mentors.map((m) => ({ m, r: matchMentor(m, picks) }));
  const order = (a: { m: BrowseMentor; r: MatchResult }, b: { m: BrowseMentor; r: MatchResult }) => {
    switch (sort) {
      case "rated":
        return (b.m.avgRating ?? 0) - (a.m.avgRating ?? 0) || b.m.reviewCount - a.m.reviewCount;
      case "low":
        return rateOf(a.m) - rateOf(b.m);
      case "high":
        return (b.m.fromRateCents ?? 0) - (a.m.fromRateCents ?? 0);
      case "new":
        return b.m.createdAt - a.m.createdAt;
      default: {
        // Best match: more groups met, then more picks met, then rating, then newest.
        const sa = (a.m.avgRating ?? 0) * Math.log2(2 + a.m.reviewCount);
        const sb = (b.m.avgRating ?? 0) * Math.log2(2 + b.m.reviewCount);
        return b.r.hit - a.r.hit || b.r.optionHits - a.r.optionHits || sb - sa || b.m.createdAt - a.m.createdAt;
      }
    }
  };
  scored.sort(order);
  const full = n ? scored.filter((x) => x.r.full) : scored;
  const partial = n ? scored.filter((x) => !x.r.full && x.r.hit > 0) : [];
  const hidden = n ? scored.filter((x) => x.r.hit === 0).length : 0;
  const pickedServices = picks.service;

  const title = !n ? `${mentors.length} ${mentors.length === 1 ? "mentor" : "mentors"}` : full.length ? `${full.length} best ${full.length === 1 ? "match" : "matches"}` : "No exact matches";
  const sub = !n
    ? "Pick what you need on the left, or tick two or three mentors to compare."
    : full.length
      ? "These mentors cover everything you picked."
      : "Here are the closest mentors. Try removing a pick.";

  return (
    <div className="gb">
      <aside className="guide" aria-label="Guided match">
        <div className="guide-head">
          <h2>
            Tell us where you are. <em>We&apos;ll narrow it down.</em>
          </h2>
          <p>Tap anything that fits. Mentors are ranked by how much they match.</p>
          <button type="button" className="btn btn-sm guide-toggle" aria-expanded={guideOpen} onClick={() => setGuideOpen((o) => !o)}>
            {guideOpen ? "Hide choices" : n ? `Edit your picks (${n})` : "Choose what you need"}
          </button>
        </div>
        <div className={`guide-body${guideOpen ? " is-open" : ""}`}>
          {GUIDED_GROUPS.map((g, i) => (
            <div key={g.key} className="guide-step">
              <div className="guide-step-head">
                <span className="guide-num">{i + 1}</span>
                <b>{g.title}</b>
                <small>{g.sub}</small>
              </div>
              <div className="guide-opts">
                {g.options.map((o) => {
                  const on = picks[g.key].includes(o.value);
                  const count = optionCount(mentors, g.key, o.value);
                  return (
                    <button key={o.value} type="button" className="guide-opt" aria-pressed={on} onClick={() => toggle(g.key, o.value)}>
                      {o.label}
                      <span className="guide-count" aria-label={`${count} ${count === 1 ? "mentor" : "mentors"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="guide-note">
            <b>Pay for hours, see every one</b>
            Buy hours at your mentor&apos;s rate and use them for calls and written work. Message or book a free 15-minute intro call first.
          </div>
        </div>
        <div className="guide-foot">
          <span>{n ? `${n} picked` : "Nothing picked yet"}</span>
          {n > 0 && <button type="button" className="link-btn" onClick={clearAll}>Clear all</button>}
        </div>
      </aside>

      <div className="stack" style={{ gap: 16, minWidth: 0 }}>
        <div className="between" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
          <div className="stack-sm" style={{ gap: 4 }}>
            <h2 className="gb-title" aria-live="polite">{title}</h2>
            <span className="text-secondary">{sub}</span>
          </div>
          <label className="row small" style={{ gap: 8 }}>
            <span className="text-secondary nowrap">Sort by</span>
            <select className="input" style={{ marginBottom: 0, width: "auto", padding: "9px 36px 9px 14px" }} value={sort} onChange={(e) => changeSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {n > 0 && (
          <div className="row-wrap" style={{ gap: 8 }}>
            {GUIDED_GROUPS.flatMap((g) =>
              picks[g.key].map((v) => (
                <button key={g.key + v} type="button" className="filter-pill filter-pill-dark" onClick={() => toggle(g.key, v)} aria-label={`Remove ${pickLabel(g.key, v)}`}>
                  {pickLabel(g.key, v)}
                  <span aria-hidden="true">×</span>
                </button>
              )),
            )}
          </div>
        )}

        {mentors.length === 0 ? (
          <div className="empty stack" style={{ alignItems: "center" }}>
            <b style={{ color: "var(--ink)", fontSize: 18 }}>No mentors match that search.</b>
            <span>Try a school, a topic like &quot;MMI&quot;, or browse everyone.</span>
            <Link href="/mentors" className="btn btn-primary">Show all mentors</Link>
          </div>
        ) : (
          <>
            {full.length > 0 && (
              <div className="stack" style={{ gap: 14 }}>
                {full.map((x, i) => <Card key={x.m.id} m={x.m} r={x.r} best={n > 0 && i === 0} picks={picks} logos={logos} />)}
              </div>
            )}
            {partial.length > 0 && (
              <>
                <div className="gb-label">Also worth a look</div>
                <div className="stack" style={{ gap: 14 }}>
                  {partial.map((x) => <Card key={x.m.id} m={x.m} r={x.r} best={false} picks={picks} logos={logos} />)}
                </div>
              </>
            )}
            {hidden > 0 && <div className="gb-label">{hidden} {hidden === 1 ? "mentor" : "mentors"} hidden · no match</div>}
          </>
        )}
      </div>

      <CompareTray highlight={pickedServices} />
    </div>
  );
}

function Card({ m, r, best, picks, logos }: { m: BrowseMentor; r: MatchResult; best: boolean; picks: Picks; logos: LogoMap }) {
  const rank = mentorRank(m.mentorStage) || mentorStageTag(m.mentorStage);
  const cred = credentialLine(m.credential, m.mentorStage);
  // Tags: picked services they cover first (highlighted), then their other
  // specialties, then who they're best for (picked ones highlighted).
  const hitServices = picks.service.filter((s) => r.groups.find((g) => g.key === "service")?.matched.includes(s)).map((s) => labelFor(SERVICES, s));
  const tags: { t: string; hit: boolean }[] = [
    ...hitServices.map((t) => ({ t, hit: true })),
    ...m.specialties.filter((s) => !hitServices.some((h) => h.toLowerCase() === s.toLowerCase())).map((t) => ({ t, hit: false })),
    ...m.bestFor.map((b) => ({ t: labelFor(BEST_FOR, b), hit: picks.best.includes(b) })),
  ];
  tags.sort((a, b) => Number(b.hit) - Number(a.hit));
  const shown = tags.slice(0, 7);
  const extra = tags.length - shown.length;
  const missing = r.groups.filter((g) => !g.hit).map((g) => g.short);

  return (
    <article className={`gb-card${best ? " is-best" : ""}`}>
      <Link href={`/mentors/${m.id}`} className="gb-photo" aria-label={`${m.name}'s profile`}>
        {m.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="avatar" style={{ background: tintFor(m.id) }}>{initialsOf(m.name)}</span>
        )}
      </Link>

      <div className="stack" style={{ gap: 9, minWidth: 0 }}>
        <div className="row-wrap" style={{ gap: 10 }}>
          <Link href={`/mentors/${m.id}`} className="display gb-name">{m.name}</Link>
          {m.avgRating !== null && m.avgRating >= 4.8 && m.reviewCount >= 5 ? <span className="badge badge-pink">Top rated</span> : m.reviewCount === 0 ? <span className="badge badge-brand">New mentor</span> : null}
        </div>
        {m.reviewCount > 0 && <Rating avg={m.avgRating} count={m.reviewCount} />}
        {cred && <span className="gb-cred">{cred}</span>}
        {(m.medicalSchool || rank) && (
          <span className="school-line text-secondary small">
            {m.medicalSchool && <SchoolLogo name={m.medicalSchool} logos={logos} size={24} title={false} />}
            <span>{[rank, m.medicalSchool].filter(Boolean).join(" · ")}</span>
          </span>
        )}
        {r.total > 0 && (
          <span className="gb-why">
            <span className="gb-bars" aria-hidden="true">{r.groups.map((g) => <i key={g.key} className={g.hit ? "on" : ""} />)}</span>
            {r.full ? (r.total === 1 ? "Matches your picks" : `Matches all ${r.total} of your picks`) : `Matches ${r.hit} of ${r.total} · not ${missing.join(", ")}`}
          </span>
        )}
        <div className="row-wrap" style={{ gap: 6 }}>
          {shown.map((x) => <span key={x.t} className={`gb-tag${x.hit ? " is-hit" : ""}`}>{x.t}</span>)}
          {extra > 0 && <span className="gb-tag is-more">+{extra} more</span>}
        </div>
        {m.knownFor && <span className="gb-known">“{m.knownFor}”</span>}
        <ClientSchools schools={m.clientSchools} logos={logos} size={26} max={8} />
      </div>

      <div className="gb-side">
        {m.fromRateCents && (
          <span className="gb-price">
            {m.fromRateCents !== m.hourlyRateCents && <small>from</small>}
            <b>{money(m.fromRateCents)}</b>
            <small>{m.fromRateCents !== m.hourlyRateCents && m.hourlyRateCents ? `per hour with bundles · ${money(m.hourlyRateCents)} single` : "per hour"}</small>
          </span>
        )}
        <Link href={`/mentors/${m.id}?intro=1`} className="btn btn-primary btn-sm">Free intro call</Link>
        <Link href={`/mentors/${m.id}`} className="btn btn-sm">View profile</Link>
        {m.totalPackages > 0 && <span className="text-muted small">{m.totalPackages} {m.totalPackages === 1 ? "package" : "packages"} · hour bundles</span>}
        <CompareToggle mentor={snapshot(m)} />
      </div>
    </article>
  );
}
