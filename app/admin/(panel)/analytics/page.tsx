import Link from "next/link";
import { currentAdmin } from "@/lib/adminTeam";
import { hogql, posthogProjectUrl, posthogReady, posthogReplayUrl, posthogTrackingOn } from "@/lib/posthog";
import { BarChart, DataTable, type TableData } from "@/components/admin/Insights";

// Admin -> Analytics: visitors to mentorsmd.com, read from PostHog on the
// server (lib/posthog.ts, cached 5 minutes). Tracking itself is
// components/PostHogAnalytics.tsx. Admins' own visits aren't counted.
// Money, orders and signups stay in Admin -> Insights.

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

type Section<T> = { rows: T[]; error?: string };

function duration(seconds: number | null | undefined) {
  const s = Math.round(Number(seconds) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
const pct = (n: number | null | undefined) => (n === null || n === undefined || isNaN(Number(n)) ? "-" : `${Math.round(Number(n) * 100)}%`);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown, empty = "(unknown)") => (v === null || v === undefined || v === "" ? empty : String(v));

// Runs the queries a few at a time (PostHog limits how many run at once per
// project). Each section succeeds or fails on its own.
async function runAll(queries: Record<string, string>) {
  const keys = Object.keys(queries);
  const out: Record<string, Section<unknown[]>> = {};
  let next = 0;
  async function worker() {
    while (next < keys.length) {
      const k = keys[next++];
      try {
        out[k] = { rows: await hogql(queries[k]) };
      } catch (e: any) {
        out[k] = { rows: [], error: e?.message || "Couldn't load this from PostHog." };
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: { days?: string } }) {
  // The layout checks this too; repeated here because the page talks to PostHog.
  const admin = await currentAdmin("analytics");
  if (!admin) return null;
  const days = (RANGES as readonly number[]).includes(Number(searchParams?.days)) ? Number(searchParams.days) : 30;

  const header = (
    <>
      <div className="stack-sm">
        <h1 className="page-title">Analytics</h1>
        <p className="lede">Who visits mentorsmd.com, which pages they see and where they come from. Admins&apos; own visits aren&apos;t counted.</p>
      </div>
      <div className="between" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map((d) => (
            <Link key={d} href={`/admin/analytics?days=${d}`} className="seg-opt" aria-pressed={d === days} scroll={false}>
              Last {d} days
            </Link>
          ))}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <a className="btn btn-sm" href={posthogProjectUrl()} target="_blank" rel="noopener noreferrer">Open in PostHog ↗</a>
          <a className="btn btn-sm" href={posthogReplayUrl()} target="_blank" rel="noopener noreferrer">Session recordings ↗</a>
        </div>
      </div>
    </>
  );

  if (!posthogReady()) {
    return (
      <div className="page stack-lg" style={{ gap: 28 }}>
        {header}
        <div className="alert alert-blue stack-sm">
          <b>Analytics isn&apos;t connected yet.</b>
          <span>
            Add the PostHog keys in Vercel (Settings → Environment Variables): <code>NEXT_PUBLIC_POSTHOG_KEY</code>, <code>NEXT_PUBLIC_POSTHOG_HOST</code>,{" "}
            <code>POSTHOG_PROJECT_ID</code> and <code>POSTHOG_PERSONAL_API_KEY</code>, then redeploy. Numbers appear here a few minutes after visitors arrive.
          </span>
          {!posthogTrackingOn() && <span className="text-secondary small">Visitor tracking is also off until <code>NEXT_PUBLIC_POSTHOG_KEY</code> is set.</span>}
        </div>
      </div>
    );
  }

  const W = `timestamp >= now() - interval ${days} day`;
  const PV = `event = '$pageview' and ${W}`;
  const SID = `properties.$session_id is not null and properties.$session_id != ''`;
  // The pages of each visit in order, for "what comes next".
  const frame = (n: number) => `over (partition by properties.$session_id order by timestamp asc rows between current row and ${n} following)`;

  const r = await runAll({
    totals: `select count(distinct person_id), count() from events where ${PV}`,
    sessions: `select count(), avg(dur), avg(if(pv <= 1, 1, 0)), avg(pv) from (
        select properties.$session_id as sid, dateDiff('second', min(timestamp), max(timestamp)) as dur, countIf(event = '$pageview') as pv
        from events where ${W} and ${SID} and event in ('$pageview', '$pageleave', '$autocapture')
        group by sid having pv > 0)`,
    perDay: `select toString(toDate(timestamp)) as d, count(distinct person_id) from events where ${PV} group by d order by d`,
    pages: `select properties.$pathname as p, count() as views, count(distinct person_id) as visitors from events where ${PV} group by p order by views desc limit 20`,
    entry: `select p, count() as c from (select argMin(properties.$pathname, timestamp) as p from events where ${PV} and ${SID} group by properties.$session_id) group by p order by c desc limit 10`,
    exit: `select p, count() as c from (select argMax(properties.$pathname, timestamp) as p from events where ${PV} and ${SID} group by properties.$session_id) group by p order by c desc limit 10`,
    referrers: `select src, count() as c from (select argMin(properties.$referring_domain, timestamp) as src from events where ${PV} and ${SID} group by properties.$session_id) group by src order by c desc limit 10`,
    utm: `select properties.utm_source as s, count(distinct properties.$session_id) as c from events where ${PV} and properties.utm_source is not null and properties.utm_source != '' group by s order by c desc limit 10`,
    nextPage: `select p, n1, count() as c from (
        select properties.$pathname as p, leadInFrame(properties.$pathname, 1) ${frame(1)} as n1
        from events where ${PV} and ${SID})
      where n1 is not null and n1 != '' and n1 != p group by p, n1 order by c desc limit 20`,
    journeys: `select p, n1, n2, count() as c from (
        select properties.$pathname as p, leadInFrame(properties.$pathname, 1) ${frame(2)} as n1, leadInFrame(properties.$pathname, 2) ${frame(2)} as n2
        from events where ${PV} and ${SID})
      where n1 is not null and n2 is not null and n1 != '' and n2 != '' and n1 != p and n2 != n1 group by p, n1, n2 order by c desc limit 15`,
    devices: `select properties.$device_type as v, count(distinct person_id) as c from events where ${PV} group by v order by c desc limit 10`,
    browsers: `select properties.$browser as v, count(distinct person_id) as c from events where ${PV} group by v order by c desc limit 10`,
    countries: `select properties.$geoip_country_name as v, count(distinct person_id) as c from events where ${PV} group by v order by c desc limit 10`,
  });

  const [visitors, pageviews] = (r.totals.rows[0] as number[] | undefined) ?? [0, 0];
  const [sessions, avgLen, bounce, pagesPerVisit] = (r.sessions.rows[0] as (number | null)[] | undefined) ?? [0, 0, null, null];

  // One bar per day, including days with no visitors.
  const byDay = new Map(r.perDay.rows.map((row) => [String(row[0]), num(row[1])]));
  const points: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    points.push({ label: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: byDay.get(d) ?? 0 });
  }

  const share = (rows: unknown[][]) => {
    const total = rows.reduce((s, row) => s + num(row[1]), 0) || 1;
    return rows.map((row) => ({ name: str(row[0]), visitors: num(row[1]), share: num(row[1]) / total }));
  };
  const source = (v: unknown) => (v === null || v === undefined || v === "" || v === "$direct" ? "Direct (typed in, bookmark or app)" : String(v));

  const cards = [
    { label: "Visitors", value: num(visitors).toLocaleString(), hint: "Different people (by browser)" },
    { label: "Page views", value: num(pageviews).toLocaleString() },
    { label: "Visits", value: num(sessions).toLocaleString(), hint: pagesPerVisit ? `${Number(pagesPerVisit).toFixed(1)} pages per visit` : undefined },
    { label: "Average visit length", value: duration(avgLen) },
    { label: "Bounce rate", value: pct(bounce), hint: "Visits that saw only one page" },
  ];

  const tables: { t: TableData; error?: string }[][] = [
    [
      {
        error: r.pages.error,
        t: {
          key: "pages",
          title: "Most visited pages",
          note: "Top 20 pages by views.",
          columns: [{ key: "path", label: "Page" }, { key: "views", label: "Views", kind: "count" }, { key: "visitors", label: "Visitors", kind: "count" }],
          rows: r.pages.rows.map((row) => ({ path: str(row[0], "/"), views: num(row[1]), visitors: num(row[2]) })),
        },
      },
    ],
    [
      {
        error: r.entry.error,
        t: {
          key: "entry",
          title: "Entry pages",
          note: "The first page of each visit.",
          columns: [{ key: "path", label: "Page" }, { key: "visits", label: "Visits", kind: "count" }],
          rows: r.entry.rows.map((row) => ({ path: str(row[0], "/"), visits: num(row[1]) })),
        },
      },
      {
        error: r.exit.error,
        t: {
          key: "exit",
          title: "Exit pages",
          note: "The last page people saw before leaving.",
          columns: [{ key: "path", label: "Page" }, { key: "visits", label: "Visits", kind: "count" }],
          rows: r.exit.rows.map((row) => ({ path: str(row[0], "/"), visits: num(row[1]) })),
        },
      },
    ],
    [
      {
        error: r.referrers.error,
        t: {
          key: "referrers",
          title: "Where visitors come from",
          note: "The website that sent each visit.",
          columns: [{ key: "source", label: "Source" }, { key: "visits", label: "Visits", kind: "count" }],
          rows: r.referrers.rows.map((row) => ({ source: source(row[0]), visits: num(row[1]) })),
        },
      },
      {
        error: r.utm.error,
        t: {
          key: "utm",
          title: "Campaign links (utm_source)",
          note: "Visits from links tagged with ?utm_source=…",
          columns: [{ key: "source", label: "utm_source" }, { key: "visits", label: "Visits", kind: "count" }],
          rows: r.utm.rows.map((row) => ({ source: str(row[0]), visits: num(row[1]) })),
        },
      },
    ],
    [
      {
        error: r.nextPage.error,
        t: {
          key: "next",
          title: "Where people go next",
          note: "After visiting one page, the page people most often open next.",
          columns: [{ key: "from", label: "After visiting" }, { key: "to", label: "people next go to" }, { key: "times", label: "Times", kind: "count" }],
          rows: r.nextPage.rows.map((row) => ({ from: str(row[0], "/"), to: str(row[1], "/"), times: num(row[2]) })),
        },
      },
    ],
    [
      {
        error: r.journeys.error,
        t: {
          key: "journeys",
          title: "Common journeys",
          note: "The most frequent three pages in a row.",
          columns: [{ key: "a", label: "First" }, { key: "b", label: "Then" }, { key: "c", label: "Then" }, { key: "times", label: "Times", kind: "count" }],
          rows: r.journeys.rows.map((row) => ({ a: str(row[0], "/"), b: str(row[1], "/"), c: str(row[2], "/"), times: num(row[3]) })),
        },
      },
    ],
    (["devices", "browsers", "countries"] as const).map((k) => ({
      error: r[k].error,
      t: {
        key: k,
        title: k === "devices" ? "Devices" : k === "browsers" ? "Browsers" : "Countries",
        columns: [{ key: "name", label: k === "devices" ? "Device" : k === "browsers" ? "Browser" : "Country" }, { key: "visitors", label: "Visitors", kind: "count" }, { key: "share", label: "Share", kind: "percent" }],
        rows: share(r[k].rows),
      },
    })),
  ];

  const topErrors = [r.totals.error, r.sessions.error, r.perDay.error].filter(Boolean);

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      {header}
      {!posthogTrackingOn() && (
        <div className="alert alert-blue">Visitor tracking is off on this deployment (<code>NEXT_PUBLIC_POSTHOG_KEY</code> isn&apos;t set), so only earlier visits are shown.</div>
      )}
      {topErrors.length > 0 && <div className="alert alert-danger">Couldn&apos;t load some numbers from PostHog: {topErrors[0]}</div>}

      <div className="ins-cards">
        {cards.map((c, i) => (
          <div key={c.label} className="stat-card" style={{ background: ["var(--tint-soft)", "var(--pink-soft)", "var(--blue)"][i % 3] }}>
            <span className="text-secondary small">{c.label}</span>
            <span className="stat-num">{c.value}</span>
            {c.hint && <span className="text-muted small">{c.hint}</span>}
          </div>
        ))}
      </div>

      <BarChart chart={{ key: "visitors", title: `Visitors per day, last ${days} days`, kind: "count", points }} />

      {tables.map((group, i) => (
        <div key={i} className={group.length > 1 ? "ins-charts" : undefined} style={group.length > 1 ? { alignItems: "start" } : undefined}>
          {group.map(({ t, error }) =>
            error ? (
              <section key={t.key} className="stack-sm">
                <h3 style={{ fontSize: 22 }}>{t.title}</h3>
                <div className="alert alert-danger small">Couldn&apos;t load this from PostHog: {error}</div>
              </section>
            ) : (
              <DataTable key={t.key} table={t} />
            )
          )}
        </div>
      ))}

      <p className="text-muted small">
        Numbers come from PostHog and are refreshed every 5 minutes. Days are in UTC. Typing in forms and message threads is never recorded, and recordings only
        run on public pages for visitors who aren&apos;t logged in.
      </p>
    </div>
  );
}
