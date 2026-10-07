"use client";

import Link from "next/link";
import { MENTOR_AGREEMENT_POINTS, MENTOR_AGREEMENT_VERSION } from "@/lib/agreement";
import { LegalBody } from "@/components/LegalBody";

// The mentor agreement checkbox (#94): at mentor signup and every time a
// package is published or saved. The version date is shown and stored.
// `doc`: the version published in Admin -> Legal (Phase 5), shown in a
// scrolling box instead of the built-in points.
export function MentorAgreement({
  checked,
  onChange,
  compact,
  doc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
  doc?: { version: number; title: string; body: string | null; publishedAt: string | null } | null;
}) {
  const published = doc && doc.version > 0 && doc.body;
  const date = new Date(published && doc!.publishedAt ? doc!.publishedAt : `${MENTOR_AGREEMENT_VERSION}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="card card-tint stack-sm" style={{ padding: compact ? 16 : 18, marginBottom: 14 }}>
      <b className="small">Mentor agreement ({published ? `version ${doc!.version}, ` : ""}updated {date})</b>
      {!compact && published && (
        <div style={{ maxHeight: 220, overflowY: "auto", background: "var(--surface)", borderRadius: 10, padding: "8px 12px" }}>
          <LegalBody body={doc!.body!} />
        </div>
      )}
      {!compact && !published && (
        <ul className="stack-sm text-secondary small" style={{ paddingLeft: 18, lineHeight: 1.5, margin: 0 }}>
          {MENTOR_AGREEMENT_POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <label className="check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
        <span className="small">
          {compact ? (
            <>I confirm this package follows the <Link href="/mentor-agreement" className="link">mentor agreement</Link>: I give feedback (I never write the student&apos;s essays or applications), and payments and calls stay on MentorsMD.</>
          ) : (
            <>
              I agree to the <Link href="/mentor-agreement" target="_blank" className="link">Mentor Agreement</Link> above, the{" "}
              <Link href="/terms" target="_blank" className="link">Terms of Service</Link>, the <Link href="/privacy" target="_blank" className="link">Privacy Policy</Link> and the{" "}
              <Link href="/community-guidelines" target="_blank" className="link">Community Guidelines</Link>.
            </>
          )}
        </span>
      </label>
    </div>
  );
}
