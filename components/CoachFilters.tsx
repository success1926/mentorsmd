"use client";

import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "ESSAY_REVIEW", label: "Essay review" },
  { value: "MOCK_INTERVIEW", label: "Mock interview" },
  { value: "APPLICATION_STRATEGY", label: "Application strategy" },
  { value: "TUTORING", label: "Tutoring" },
  { value: "OTHER", label: "Other" },
];

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
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
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <select className="input" style={{ width: "auto", marginBottom: 0 }} value={category} onChange={(e) => updateParam("category", e.target.value)}>
        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <select className="input" style={{ width: "auto", marginBottom: 0 }} value={sort} onChange={(e) => updateParam("sort", e.target.value)}>
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  );
}
