"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { type: string; label: string; sub: string; href: string };

// The search box at the top of the admin sidebar: people, orders (by id),
// leads, mentor applications and calls, limited to what the admin's role
// can see (/api/admin/search). Arrow keys pick a result, Enter opens it,
// and Cmd+K / Ctrl+K jumps to the box from anywhere in Admin.
export function AdminSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const hitsFor = useRef(""); // the search the shown results belong to

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  // Searches a moment after typing stops.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          hitsFor.current = term;
          setHits(d.hits || []);
          setSel(0);
          setBusy(false);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setBusy(false);
        });
    }, 200);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  function go(h: Hit) {
    setOpen(false);
    setQ("");
    // A full load when it's the page already showing, so it opens the result.
    if (window.location.pathname === h.href.split("?")[0]) window.location.href = h.href;
    else router.push(h.href);
  }

  const showing = open && q.trim().length >= 2;

  return (
    <div className="adm-search" ref={box}>
      <input
        ref={input}
        type="search"
        className="input"
        value={q}
        placeholder="Search people, orders, leads…"
        aria-label="Search Admin: people, orders, leads, applications and calls"
        aria-expanded={showing}
        aria-controls="adm-search-results"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === "Enter" && hits[sel] && hitsFor.current === q.trim()) {
            // Only once the results match what's typed (not the previous search's).
            e.preventDefault();
            go(hits[sel]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {showing && (
        <ul className="adm-search-results" id="adm-search-results" role="listbox">
          {hits.map((h, i) => (
            <li key={h.href + h.label + i} role="option" aria-selected={i === sel}>
              <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
                <b>{h.label}</b>
                <span>{h.sub}</span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="adm-search-empty">{busy ? "Searching…" : `Nothing found for "${q.trim()}".`}</li>}
        </ul>
      )}
    </div>
  );
}
