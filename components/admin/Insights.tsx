"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/options";

// Building blocks for Admin -> Insights: stat cards, bar charts, sortable
// tables and funnels. Every table and chart has a CSV download (#84),
// served by /api/admin/insights with the same filters.

type Kind = "text" | "money" | "count" | "percent" | "rating" | "date" | "hours";
export type Col = { key: string; label: string; kind?: Kind; link?: string };
export type Row = Record<string, string | number | null>;
export type TableData = { key: string; title: string; note?: string; columns: Col[]; rows: Row[]; sort?: { key: string; dir: "asc" | "desc" } };
export type CardData = { key: string; label: string; value: number | null; kind: Kind; hint?: string };
export type ChartData = { key: string; title: string; kind: "money" | "count"; points: { label: string; value: number }[] };
export type FunnelData = { title: string; note?: string; steps: { label: string; value: number; unit: string }[] };

const NUMERIC: Kind[] = ["money", "count", "percent", "rating", "hours"];

export function fmt(v: string | number | null | undefined, kind: Kind = "text"): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "number") {
    if (kind === "money") return money(v);
    if (kind === "percent") return `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
    if (kind === "rating") return v.toFixed(1);
    if (kind === "hours") return `${v.toFixed(1)} h`;
    return v.toLocaleString();
  }
  if (kind === "date") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  return v;
}

export function CsvLink({ href, label = "Download CSV" }: { href: string; label?: string }) {
  return (
    <a className="btn btn-sm" href={href} download>
      {label}
    </a>
  );
}

export function StatCards({ cards, csvHref }: { cards: CardData[]; csvHref?: string }) {
  const tints = ["var(--tint-soft)", "var(--pink-soft)", "var(--blue)"];
  return (
    <div className="stack-sm">
      <div className="ins-cards">
        {cards.map((c, i) => (
          <div key={c.key} className="stat-card" style={{ background: tints[i % tints.length] }}>
            <span className="text-secondary small">{c.label}</span>
            <span className="stat-num">{fmt(c.value, c.kind)}</span>
            {c.hint && <span className="text-muted small">{c.hint}</span>}
          </div>
        ))}
      </div>
      {csvHref && (
        <div>
          <CsvLink href={csvHref} label="Download these numbers (CSV)" />
        </div>
      )}
    </div>
  );
}

// One series, one bar per day / week / month. Hover or focus a bar for its value.
export function BarChart({ chart, csvHref }: { chart: ChartData; csvHref: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = chart.points;
  const max = Math.max(1, ...pts.map((p) => p.value));
  const total = pts.reduce((s, p) => s + p.value, 0);
  const W = 600;
  const H = 150;
  const top = 14;
  const base = H - 20;
  const slot = W / Math.max(1, pts.length);
  const gap = Math.min(2, slot * 0.2);
  const barW = Math.max(1, slot - gap);
  const show = (v: number) => (chart.kind === "money" ? money(v) : v.toLocaleString());

  return (
    <div className="card chart-card stack-sm">
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="stack-sm" style={{ gap: 0 }}>
          <b>{chart.title}</b>
          <span className="text-muted small">Total {show(total)}</span>
        </span>
        <CsvLink href={csvHref} label="CSV" />
      </div>
      <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
        <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${chart.title}: total ${show(total)}`}>
          <line className="chart-grid" x1={0} x2={W} y1={top} y2={top} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <line className="chart-grid" x1={0} x2={W} y1={base} y2={base} vectorEffect="non-scaling-stroke" />
          {pts.map((p, i) => {
            const h = p.value > 0 ? Math.max(2, ((base - top) * p.value) / max) : 0;
            const x = i * slot + gap / 2;
            const r = Math.min(4, barW / 2, h);
            const y = base - h;
            const d = h > 0 ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${base} Z` : "";
            return (
              <g key={i}>
                {d && <path d={d} className={hover === i ? "chart-bar-hover" : "chart-bar"} />}
                {/* bigger invisible hit area for hover */}
                <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        <div className="between chart-axis small text-muted" style={{ marginTop: 2 }}>
          <span>{pts[0]?.label}</span>
          <span>max {show(max === 1 && pts.every((p) => p.value === 0) ? 0 : max)}</span>
          <span>{pts[pts.length - 1]?.label}</span>
        </div>
        {hover !== null && pts[hover] && (
          <div className="chart-tip" style={{ left: `${((hover + 0.5) / pts.length) * 100}%`, top: 0 }}>
            {pts[hover].label}: <b>{show(pts[hover].value)}</b>
          </div>
        )}
      </div>
    </div>
  );
}

export function DataTable({ table, csvHref, pageSize = 50 }: { table: TableData; csvHref: string; pageSize?: number }) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(table.sort || null);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    if (!sort) return table.rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...table.rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === y) return 0;
      if (x === null || x === undefined || x === "") return 1; // blanks last
      if (y === null || y === undefined || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }, [table.rows, sort]);
  const shown = all ? rows : rows.slice(0, pageSize);

  function toggle(c: Col) {
    const numeric = NUMERIC.includes(c.kind || "text") || c.kind === "date";
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: numeric ? "desc" : "asc" }));
  }

  return (
    <section className="stack-sm">
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="stack-sm" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 22 }}>{table.title}</h3>
          {table.note && <span className="text-muted small">{table.note}</span>}
        </span>
        <CsvLink href={csvHref} />
      </div>
      {table.rows.length === 0 ? (
        <div className="card text-muted small" style={{ padding: 16 }}>Nothing here for these dates yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {table.columns.map((c) => {
                  const num = NUMERIC.includes(c.kind || "text");
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} className={num ? "num" : undefined} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => toggle(c)}>
                        {c.label}
                        <span aria-hidden="true">{active ? (sort!.dir === "asc" ? "▲" : "▼") : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={(r.id as string) || i}>
                  {table.columns.map((c) => {
                    const num = NUMERIC.includes(c.kind || "text");
                    const text = fmt(r[c.key], c.kind);
                    const href = c.link ? (r[c.link] as string | null) : null;
                    const long = !num && typeof r[c.key] === "string" && (r[c.key] as string).length > 40;
                    return (
                      <td key={c.key} className={num ? "num" : long ? "wrap-cell" : undefined}>
                        {href ? <Link href={href} className="link">{text}</Link> : text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > pageSize && (
        <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all ${rows.length.toLocaleString()} rows`}
        </button>
      )}
    </section>
  );
}

export function Funnel({ funnel, csvHref }: { funnel: FunnelData; csvHref?: string }) {
  const first = funnel.steps[0]?.value || 0;
  const max = Math.max(1, ...funnel.steps.map((s) => s.value));
  return (
    <section className="card stack-sm">
      <div className="between" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="stack-sm" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 22 }}>{funnel.title}</h3>
          {funnel.note && <span className="text-muted small">{funnel.note}</span>}
        </span>
        {csvHref && <CsvLink href={csvHref} label="CSV" />}
      </div>
      {funnel.steps.map((s, i) => {
        const prev = i > 0 ? funnel.steps[i - 1].value : null;
        return (
          <div key={s.label} className="funnel-row">
            <span className="small">
              <b>{s.label}</b>
              <br />
              <span className="text-muted">
                {i === 0 ? s.unit : prev ? `${Math.round((s.value / prev) * 100)}% of previous step` : "-"}
                {i > 0 && first ? ` · ${Math.round((s.value / first) * 100)}% of first` : ""}
              </span>
            </span>
            <div className="funnel-track" aria-label={`${s.label}: ${s.value} ${s.unit}`}>
              <div className="funnel-fill" style={{ width: `${(s.value / max) * 100}%` }} />
              <span className="funnel-val">{s.value.toLocaleString()} {s.unit}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
