"use client";

import Link from "next/link";
import type { ProfileSection } from "@/lib/profileCompleteness";

// "Finish your profile - N of 10 sections", on the mentor dashboard and the
// Account page. Students can't find or buy from a mentor until every
// section is done (lib/profileCompleteness.ts).
export function ProfileChecklist({
  progress,
  compact = false,
}: {
  progress: { sections: ProfileSection[]; done: number; total: number; complete: boolean } | null | undefined;
  compact?: boolean;
}) {
  if (!progress) return null;
  if (progress.complete) {
    return compact ? null : (
      <div className="alert alert-success" role="status">
        <b>Your profile is complete.</b> Students can find you on Browse mentors and buy from you.
      </div>
    );
  }
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <section className="card stack" aria-labelledby="finish-profile-title" style={{ borderColor: "var(--tint-2)" }}>
      <div className="stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2 id="finish-profile-title" style={{ fontSize: 24 }}>Finish your profile</h2>
          <b>{progress.done} of {progress.total} sections</b>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label="Profile sections finished"
          style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)" }} />
        </div>
        <span className="text-secondary">
          Students can&apos;t find you on Browse mentors, or buy from you, until every section is filled in.
        </span>
      </div>
      <ul className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0, gap: 6 }}>
        {progress.sections.map((s) => (
          <li key={s.key} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <span
              aria-hidden="true"
              style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: s.done ? "var(--primary)" : "#fff",
                color: s.done ? "#fff" : "var(--primary)",
                border: s.done ? "none" : "2px solid var(--tint-2)",
              }}
            >
              {s.done ? "✓" : ""}
            </span>
            <span className="grow">
              <span style={{ fontWeight: s.done ? 400 : 600 }}>{s.label}</span>
              <span className="sr-only">{s.done ? " (done)" : " (not done)"}</span>
              {!s.done && s.hint && <span className="text-muted small"> · {s.hint}</span>}
            </span>
            {!s.done && (
              <Link href={s.href} className="link small nowrap">
                Fill in
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
