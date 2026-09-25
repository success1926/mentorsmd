"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Used in several places: a compact version in the top nav, the big hero
// version on the homepage, and a regular version atop the /coaches list.
// All just navigate to "{target}?q=..." - the actual filtering happens
// server-side, so this component doesn't need to know anything about
// coaches or gigs.
export function SearchBar({
  initialValue = "",
  compact = false,
  large = false,
  placeholder = "Search coaches or packages...",
  target = "/coaches",
  buttonLabel = "Search",
}: {
  initialValue?: string;
  compact?: boolean;
  large?: boolean;
  placeholder?: string;
  target?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(query.trim() ? `${target}?q=${encodeURIComponent(query.trim())}` : target);
  }

  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );

  if (large) {
    return (
      <form onSubmit={handleSubmit} className="hero-search" role="search">
        {icon}
        <input aria-label={placeholder} placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn btn-solid btn-lg">{buttonLabel}</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} role="search" style={{ display: "flex", gap: 8, width: compact ? "auto" : "100%" }}>
      <input
        className="input"
        aria-label={placeholder}
        style={{ marginBottom: 0, width: compact ? 200 : "100%", ...(compact ? { padding: "9px 12px", fontSize: 14 } : {}) }}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!compact && (
        <button type="submit" className="btn btn-solid">
          {buttonLabel}
        </button>
      )}
    </form>
  );
}
