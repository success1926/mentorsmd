"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Stars, tintFor, initialsOf } from "@/components/ui";
import { ADMISSIONS_ROLE_TYPES, BEST_FOR, SERVICES, labelFor, mentorRank, mentorStageTag, money } from "@/lib/options";
import { hasService, type MatchableMentor } from "@/lib/guidedMatch";

// Compare (Browse redesign, Nov 2026): students tick up to three mentors on
// Browse or on a profile, and a tray at the bottom of the screen shows them
// side by side. The picks live in this browser only (localStorage), so the
// tray follows the student from Browse to a profile and back. Only public
// profile details are stored.

export const COMPARE_MAX = 3;
const KEY = "mmd-compare-v1";

export type CompareMentor = {
  id: string;
  name: string;
  photoUrl: string | null;
  stage: string; // "MS4", "Resident", ...
  school: string | null;
  rateCents: number | null;
  fromRateCents: number | null;
  packageCount: number;
  bestFor: string[]; // labels
  services: string[]; // SERVICES values they help with
  roles: string[]; // labels, e.g. "Interviewer"
  knownFor: string | null;
  languages: string[];
  avgRating: number | null;
  reviewCount: number;
};

// Builds the stored snapshot from the fields Browse and the profile both have.
export function compareSnapshot(m: MatchableMentor & {
  id: string; name: string; photoUrl: string | null; mentorStage: string | null; school: string | null;
  hourlyRateCents: number | null; fromRateCents: number | null; packageCount: number;
  roleTypes: string[]; knownFor: string | null; languages: string[]; avgRating: number | null; reviewCount: number;
}): CompareMentor {
  return {
    id: m.id,
    name: m.name,
    photoUrl: m.photoUrl,
    stage: mentorRank(m.mentorStage) || mentorStageTag(m.mentorStage),
    school: m.school,
    rateCents: m.hourlyRateCents,
    fromRateCents: m.fromRateCents,
    packageCount: m.packageCount,
    bestFor: m.bestFor.map((b) => labelFor(BEST_FOR, b)),
    services: SERVICES.filter((s) => s.value !== "OTHER" && hasService(m, s.value)).map((s) => s.value),
    roles: Array.from(new Set(m.roleTypes.map((r) => labelFor(ADMISSIONS_ROLE_TYPES, r)))),
    knownFor: m.knownFor,
    languages: m.languages,
    avgRating: m.avgRating,
    reviewCount: m.reviewCount,
  };
}

// ---- tiny store (shared by every component on the page, and other tabs) ----
let cache: CompareMentor[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: CompareMentor[] = [];

function read(): CompareMentor[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    cache = [];
  }
  return cache!;
}
function write(next: CompareMentor[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode etc.: still works for this page
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompare() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = (id: string) => items.some((m) => m.id === id);
  return {
    items,
    has,
    full: items.length >= COMPARE_MAX,
    toggle(m: CompareMentor) {
      const cur = read();
      if (cur.some((x) => x.id === m.id)) write(cur.filter((x) => x.id !== m.id));
      else if (cur.length < COMPARE_MAX) write([...cur, m]);
    },
    // Keeps a stored mentor's details fresh (rate changes etc.).
    refresh(m: CompareMentor) {
      const cur = read();
      if (cur.some((x) => x.id === m.id) && JSON.stringify(cur.find((x) => x.id === m.id)) !== JSON.stringify(m)) write(cur.map((x) => (x.id === m.id ? m : x)));
    },
    remove(id: string) {
      write(read().filter((x) => x.id !== id));
    },
    clear() {
      write([]);
    },
  };
}

// ---- the tick box ----
export function CompareToggle({ mentor, label = "Compare" }: { mentor: CompareMentor; label?: string }) {
  const c = useCompare();
  const on = c.has(mentor.id);
  const disabled = !on && c.full;
  return (
    <button
      type="button"
      className="compare-toggle"
      aria-pressed={on}
      disabled={disabled}
      title={disabled ? `You can compare up to ${COMPARE_MAX} mentors` : undefined}
      onClick={() => c.toggle(mentor)}
    >
      <span className="compare-box" aria-hidden="true">✓</span>
      {on ? "Comparing" : label}
    </button>
  );
}

function Face({ m, size }: { m: CompareMentor; size: number }) {
  return m.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.photoUrl} alt="" width={size} height={size} loading="lazy" decoding="async" style={{ width: size, height: size, borderRadius: size > 40 ? 12 : "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, borderRadius: size > 40 ? 12 : "50%", background: tintFor(m.id) }}>{initialsOf(m.name)}</span>
  );
}

// ---- the tray ----
export function CompareTray({ highlight = [] }: { highlight?: string[] }) {
  const c = useCompare();
  const [open, setOpen] = useState(false);
  const n = c.items.length;
  useEffect(() => {
    if (n < 2) setOpen(false);
  }, [n]);
  // Leave room at the bottom of the page so the tray never covers the footer.
  useEffect(() => {
    document.body.classList.toggle("has-compare", n > 0);
    return () => document.body.classList.remove("has-compare");
  }, [n]);
  if (n === 0) return null;

  const ms = c.items;
  const lowest = Math.min(...ms.map((m) => m.fromRateCents ?? Number.MAX_SAFE_INTEGER));
  const services = SERVICES.filter((s) => ms.some((m) => m.services.includes(s.value)));
  const yes = <span className="cmp-yes" aria-label="Yes">✓</span>;
  const no = <span className="cmp-no" aria-label="No">—</span>;
  const row = (label: string, cells: React.ReactNode[], hl = false) => (
    <tr key={label} className={hl ? "is-hl" : undefined}>
      <th scope="row">{label}</th>
      {cells.map((x, i) => <td key={i}>{x}</td>)}
    </tr>
  );

  return (
    <div className="compare-tray" role="region" aria-label="Compare mentors">
      <div className="compare-in">
        <div className="compare-bar">
          <b className="compare-title">{n > 1 ? `Comparing ${n} mentors` : "Pick one more to compare"}</b>
          <div className="compare-faces">
            {ms.map((m) => (
              <span key={m.id} className="compare-face">
                <Face m={m} size={28} />
                {m.name.split(" ")[0]}
                <button type="button" onClick={() => c.remove(m.id)} aria-label={`Remove ${m.name} from compare`}>×</button>
              </span>
            ))}
            {n < COMPARE_MAX && <span className="compare-slot">{n < 2 ? "+ add a mentor" : "+ add one more"}</span>}
          </div>
          <div className="compare-acts">
            <button type="button" className="btn btn-sm compare-ghost" onClick={() => c.clear()}>Clear</button>
            <button type="button" className="btn btn-primary btn-sm toggle-btn" disabled={n < 2} aria-expanded={open && n > 1} aria-controls="compare-table" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide comparison" : "Compare side by side"}
            </button>
          </div>
        </div>
        {open && n > 1 && (
          <div className="compare-table" id="compare-table">
            <table>
              <thead>
                <tr>
                  <td />
                  {ms.map((m) => (
                    <td key={m.id}>
                      <Link href={`/mentors/${m.id}`} className="compare-who">
                        <Face m={m} size={52} />
                        <span>
                          <b>{m.name}</b>
                          <small>{[m.stage, m.school].filter(Boolean).join(" · ")}</small>
                        </span>
                      </Link>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row("Rate", ms.map((m) => (
                  <>
                    {m.rateCents ? `${money(m.rateCents)}/hr` : "Not set"}
                    {m.fromRateCents !== null && m.fromRateCents === lowest && n > 1 && <span className="cmp-best">Lowest</span>}
                    {m.fromRateCents && m.rateCents && m.fromRateCents < m.rateCents && <small className="cmp-sub">from {money(m.fromRateCents)}/hr with bundles</small>}
                  </>
                )))}
                {row("Packages", ms.map((m) => (m.packageCount ? `${m.packageCount} ${m.packageCount === 1 ? "package" : "packages"}` : "Hours only")))}
                {row("Best for", ms.map((m) => m.bestFor.join(", ") || "—"))}
                {services.map((s) => row(s.label, ms.map((m) => (m.services.includes(s.value) ? yes : no)), highlight.includes(s.value)))}
                {row("Admissions roles", ms.map((m) => m.roles.join(" · ") || "—"))}
                {row("Known for", ms.map((m) => (m.knownFor ? <em className="cmp-known">“{m.knownFor}”</em> : "—")))}
                {row("Languages", ms.map((m) => m.languages.join(", ") || "—"))}
                {row("Reviews", ms.map((m) => (m.reviewCount ? <Stars value={m.avgRating ?? 0} count={m.reviewCount} compact /> : "New to MentorsMD")))}
                <tr>
                  <th scope="row" />
                  {ms.map((m) => (
                    <td key={m.id}>
                      <div className="row-wrap" style={{ gap: 8 }}>
                        <Link href={`/mentors/${m.id}?intro=1`} className="btn btn-primary btn-sm">Free intro call</Link>
                        <Link href={`/mentors/${m.id}`} className="btn btn-sm compare-ghost">Profile</Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
