import type { ReactNode } from "react";

// Numbered steps, one look on every public page. "grid": the big
// four-across row (How it works); "list": a compact numbered list for
// side panels and forms (Become a mentor, Gift). Server-safe.
export type Step = { title: ReactNode; body?: ReactNode };

export function Steps({ steps, variant = "grid" }: { steps: (Step | string)[]; variant?: "grid" | "list" }) {
  const items = steps.map((s) => (typeof s === "string" ? { title: s } : s));
  if (variant === "list") {
    return (
      <ol className="steps-list">
        {items.map((s, i) => (
          <li key={i}>
            <span className="steps-num" aria-hidden="true">{i + 1}</span>
            <span className="steps-text">
              {s.body ? <b>{s.title}</b> : s.title}
              {s.body && <span className="text-secondary">{s.body}</span>}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="step-grid">
      {items.map((s, i) => (
        <li key={i}>
          <span className="vet-num">{String(i + 1).padStart(2, "0")}</span>
          <h3>{s.title}</h3>
          {s.body && <p>{s.body}</p>}
        </li>
      ))}
    </ol>
  );
}
