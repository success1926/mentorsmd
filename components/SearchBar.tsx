"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Used in three places: a compact version in the top nav (works from any
// page), a large hero version on the homepage, and a regular version atop
// the /coaches list. All just navigate to "{target}?q=..." - the actual
// filtering happens server-side, so this component doesn't need to know
// anything about coaches or gigs.
export function SearchBar({
  initialValue = "",
  compact = false,
  large = false,
  placeholder = "Search coaches or packages...",
  target = "/coaches",
}: {
  initialValue?: string;
  compact?: boolean;
  large?: boolean;
  placeholder?: string;
  target?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(query.trim() ? `${target}?q=${encodeURIComponent(query.trim())}` : target);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, width: compact ? "auto" : "100%" }}>
      <input
        className="input"
        style={{
          marginBottom: 0,
          width: compact ? 180 : "100%",
          ...(large ? { fontSize: 17, padding: "16px 18px", borderRadius: 12 } : {}),
        }}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        type="submit"
        className="btn"
        style={large ? { fontSize: 15, padding: "0 22px", borderRadius: 12, background: "#1E5631", border: "none", color: "#fff", fontWeight: 600 } : undefined}
      >
        Search
      </button>
    </form>
  );
}
