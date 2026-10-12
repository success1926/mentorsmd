"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AdminGuard, AdminNav } from "@/components/admin/AdminNav";
import { BarChart, DataTable, Funnel, StatCards, type CardData, type ChartData, type FunnelData, type TableData } from "@/components/admin/Insights";
import { browserTimeZone } from "@/lib/tz";

// Admin -> Insights (#77-#86): sales and fees, mentor leaderboard,
// breakdowns, activity, funnels, student demand, students and the private
// activity log. Every table and chart downloads as CSV (#84).

const TABS = [
  { key: "overview", label: "Overview", lede: "Sales, fees, payouts, refunds and new accounts." },
  { key: "mentors", label: "Mentor leaderboard", lede: "Every mentor side by side. Click a column to sort." },
  { key: "breakdowns", label: "Breakdowns", lede: "Sales and supply by school, MD/DO, stage, service, format, price and turnaround." },
  { key: "activity", label: "Activity", lede: "Who is using the site, messages, calls, no-shows and quiet mentors." },
  { key: "funnel", label: "Funnel", lede: "From first visit to approved work, site-wide and for each mentor." },
  { key: "demand", label: "Student demand", lede: "What students search and filter for, and what they don't find." },
  { key: "students", label: "Students", lede: "Top spenders, repeat orders and where students come from." },
  { key: "log", label: "Activity log", lede: "Private log of visits, profile views, searches and signups. Only admins can see it." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PRESETS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "ytd", label: "This year", days: 0 },
  { key: "custom", label: "Custom", days: 0 },
];

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presetRange(key: string) {
  const today = new Date();
  const to = localDay(today);
  if (key === "ytd") return { from: `${today.getFullYear()}-01-01`, to };
  const days = PRESETS.find((p) => p.key === key)?.days || 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: localDay(from), to };
}

type Data = {
  range: { from: string; to: string; bucket: string };
  cards?: CardData[];
  charts?: ChartData[];
  funnels?: (FunnelData & { key: string })[];
  tables: TableData[];
  options?: Record<string, { value: string; label: string }[]>;
  error?: string;
};

export default function InsightsPage() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [tab, setTab] = useState<TabKey>("overview");
  const [preset, setPreset] = useState("30");
  const [from, setFrom] = useState(() => presetRange("30").from);
  const [to, setTo] = useState(() => presetRange("30").to);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  // Open the tab named in the address (?tab=funnel), and keep it there.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey);
  }, []);
  function pickTab(t: TabKey) {
    setTab(t);
    setFilters({});
    setData(null);
    try {
      window.history.replaceState(null, "", `/admin/insights?tab=${t}`);
    } catch {
      // fine
    }
  }

  const query = useMemo(() => {
    const p = new URLSearchParams({ tab, from, to, tz: browserTimeZone() || "" });
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    return p.toString();
  }, [tab, from, to, filters]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/insights?${query}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setData(d))
        .catch(() => !cancelled && setData({ error: "Couldn't load these numbers. Try again.", tables: [] } as any))
        .finally(() => !cancelled && setLoading(false));
    }, 200); // small pause while typing in the search boxes
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAdmin, query]);

  const guard = AdminGuard({ status, isAdmin });
  if (guard) return guard;

  const csv = (table: string) => `/api/admin/insights?${query}&format=csv&table=${encodeURIComponent(table)}`;
  const setFilter = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const info = TABS.find((t) => t.key === tab)!;
  const opts = data?.options || {};

  return (
    <div className="page stack-lg" style={{ gap: 28 }}>
      <div className="stack-sm">
        <h1 className="page-title">Insights</h1>
        <p className="lede">How MentorsMD is doing: money, mentors, students and what people look for.</p>
      </div>
      <AdminNav />

      <div className="tabs" role="tablist" aria-label="Insights sections" style={{ marginBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" className="tab" aria-selected={tab === t.key} onClick={() => pickTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date range: applies to every section */}
      <div className="card stack-sm" style={{ padding: 18 }}>
        <span className="text-secondary small">{info.lede}</span>
        <div className="seg" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="seg-opt"
              aria-pressed={preset === p.key}
              onClick={() => {
                setPreset(p.key);
                if (p.key !== "custom") {
                  const r = presetRange(p.key);
                  setFrom(r.from);
                  setTo(r.to);
                }
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="ins-filters">
            <label className="field"><span className="field-label">From</span>
              <input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
            <label className="field"><span className="field-label">To</span>
              <input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
          </div>
        )}
        <span className="text-muted small">
          {fmtDay(from)} to {fmtDay(to)}
          {data?.range?.bucket && data.range.bucket !== "day" ? ` · charts grouped by ${data.range.bucket}` : ""}
          {loading ? " · Loading…" : ""}
        </span>
      </div>

      {/* Section-specific filters */}
      {tab === "mentors" && (
        <div className="ins-filters">
          <Select label="Medical school" value={filters.school || ""} onChange={(v) => setFilter("school", v)} options={opts.school || []} />
          <Select label="MD / DO" value={filters.type || ""} onChange={(v) => setFilter("type", v)} options={opts.type || []} />
          <Select label="Stage" value={filters.stage || ""} onChange={(v) => setFilter("stage", v)} options={opts.stage || []} />
          <Select label="Service" value={filters.service || ""} onChange={(v) => setFilter("service", v)} options={opts.service || []} />
        </div>
      )}
      {tab === "funnel" && (
        <div className="ins-filters">
          <Select label="Funnel for one mentor" value={filters.mentor || ""} onChange={(v) => setFilter("mentor", v)} options={opts.mentor || []} empty="Pick a mentor" />
        </div>
      )}
      {tab === "log" && (
        <div className="ins-filters">
          <Select
            label="What"
            value={filters.kind || ""}
            onChange={(v) => setFilter("kind", v)}
            options={[
              { value: "VISIT", label: "Visits" },
              { value: "PROFILE_VIEW", label: "Profile views" },
              { value: "SEARCH", label: "Searches" },
              { value: "SIGNUP", label: "Signups" },
            ]}
          />
          <label className="field"><span className="field-label">Name, email or search words</span>
            <input className="input" value={filters.who || ""} onChange={(e) => setFilter("who", e.target.value)} placeholder="Filter the log" /></label>
        </div>
      )}

      {data?.error && <div className="alert alert-danger">{data.error}</div>}
      {!data && <p className="text-muted">Loading…</p>}

      {data && !data.error && (
        <div className="stack-lg" style={{ gap: 32, opacity: loading ? 0.6 : 1 }}>
          {data.cards && data.cards.length > 0 && <StatCards cards={data.cards} csvHref={csv("summary")} />}
          {data.charts && data.charts.length > 0 && (
            <div className="ins-charts">
              {data.charts.map((c) => <BarChart key={c.key} chart={c} csvHref={csv(c.key)} />)}
            </div>
          )}
          {data.funnels?.map((f) => <Funnel key={f.key} funnel={f} csvHref={csv(f.key)} />)}
          {tab === "funnel" && !filters.mentor && <span className="text-muted small">Pick a mentor above to see their own funnel.</span>}
          {data.tables.map((t) => <DataTable key={`${tab}-${t.key}`} table={t} csvHref={csv(t.key)} />)}
        </div>
      )}
    </div>
  );
}

function fmtDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Select({ label, value, onChange, options, empty = "All" }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; empty?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
