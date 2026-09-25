"use client";

import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "", label: "All services" },
  { value: "ESSAY_REVIEW", label: "Essay review" },
  { value: "MOCK_INTERVIEW", label: "Mock interview" },
  { value: "APPLICATION_STRATEGY", label: "Application strategy" },
  { value: "TUTORING", label: "Tutoring" },
  { value: "OTHER", label: "Other" },
];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export function CoachFilters({
  query,
  category,
  sort,
}: {
  query: string;
  category: string;
  sort: string;
}) {
  const router = useRouter();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (sort) params.set("sort", sort);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/coaches?${params.toString()}`);
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label="Filter by service">
        {CATEGORIES.map((c) => {
          const active = c.value === category;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => updateParam("category", c.value)}
              className={`chip ${active ? "chip-active" : ""}`}
              style={{ cursor: "pointer", fontFamily: "inherit" }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <label className="text-secondary" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
        Sort by
        <select
          className="input"
          style={{ width: "auto", marginBottom: 0, fontWeight: 600 }}
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
    </div>
  );
}
