"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FILTER_GROUPS } from "@/lib/options";

// The left-hand filter sidebar on /mentors. Every change updates the URL
// (so results are shareable and the back button works); the page itself
// is rendered on the server from those URL params.
function useFilterNav() {
  const router = useRouter();
  const params = useSearchParams();
  function go(next: URLSearchParams) {
    const qs = next.toString();
    router.push(qs ? `/mentors?${qs}` : "/mentors", { scroll: false });
  }
  return { params, go };
}

export function BrowseFilters() {
  const { params, go } = useFilterNav();
  const anySelected = FILTER_GROUPS.some((g) => params.getAll(g.key).length > 0);

  function toggle(key: string, value: string, multi: boolean) {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key);
    next.delete(key);
    if (multi) {
      const set = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      set.forEach((v) => next.append(key, v));
    } else if (!current.includes(value)) {
      next.set(key, value);
    }
    go(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const q = params.get("q");
    const sort = params.get("sort");
    if (q) next.set("q", q);
    if (sort) next.set("sort", sort);
    go(next);
  }

  return (
    <div>
      <div className="between" style={{ paddingBottom: 8 }}>
        <b style={{ fontSize: 18 }}>Filters</b>
        {anySelected && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: "var(--primary)" }}>
            Clear all
          </button>
        )}
      </div>
      {FILTER_GROUPS.map((g) => {
        const selected = params.getAll(g.key);
        return (
          <details key={g.key} className="filter-group" open={g.key !== "turnaround" && g.key !== "price" && g.key !== "rating" ? true : selected.length > 0}>
            <summary style={{ listStyle: "none", cursor: "pointer" }} className="between">
              <span className="stack-sm" style={{ gap: 2 }}>
                <span className="filter-title" style={{ margin: 0 }}>{g.title}</span>
                <span className="text-muted">{g.sub}</span>
              </span>
              {selected.length > 0 && <span className="tab-count">{selected.length}</span>}
            </summary>
            <div style={{ paddingTop: 8 }}>
              {g.options.map((o) => (
                <label key={o.value} className="check">
                  <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(g.key, o.value, g.multi)} />
                  {o.label}
                </label>
              ))}
            </div>
          </details>
        );
      })}
      <div className="card card-tint stack-sm" style={{ marginTop: 16, padding: 18 }}>
        <b>Payment held until you approve</b>
        <span className="text-secondary" style={{ fontSize: 14 }}>
          You pay when you book. We hold it until you approve the work. Message first, and booking unlocks once your mentor replies.
        </span>
      </div>
    </div>
  );
}

export function SortSelect({ value }: { value: string }) {
  const { params, go } = useFilterNav();
  return (
    <label className="row small" style={{ gap: 8 }}>
      <span className="text-secondary nowrap">Sort by</span>
      <select
        className="input"
        style={{ marginBottom: 0, width: "auto", padding: "9px 36px 9px 14px" }}
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === "best") next.delete("sort");
          else next.set("sort", e.target.value);
          go(next);
        }}
      >
        <option value="best">Best match</option>
        <option value="rated">Highest rated</option>
        <option value="low">Price: low to high</option>
        <option value="high">Price: high to low</option>
        <option value="new">Newest</option>
      </select>
    </label>
  );
}
