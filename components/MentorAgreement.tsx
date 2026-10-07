"use client";

import Link from "next/link";
import { MENTOR_AGREEMENT_POINTS, MENTOR_AGREEMENT_VERSION } from "@/lib/agreement";

// The mentor agreement checkbox (#94): at mentor signup and every time a
// package is published or saved. The version date is shown and stored.
export function MentorAgreement({ checked, onChange, compact }: { checked: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  const date = new Date(`${MENTOR_AGREEMENT_VERSION}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="card card-tint stack-sm" style={{ padding: compact ? 16 : 18, marginBottom: 14 }}>
      <b className="small">Mentor agreement (updated {date})</b>
      {!compact && (
        <ul className="stack-sm text-secondary small" style={{ paddingLeft: 18, lineHeight: 1.5, margin: 0 }}>
          {MENTOR_AGREEMENT_POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      <label className="check" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} />
        <span className="small">
          {compact ? (
            <>I confirm this package follows the <Link href="/community-guidelines" className="link">mentor agreement</Link>: I give feedback (I never write the student&apos;s essays or applications), and payments and calls stay on MentorsMD.</>
          ) : (
            <>I agree to the mentor agreement above and the <Link href="/community-guidelines" className="link">Community Guidelines</Link>.</>
          )}
        </span>
      </label>
    </div>
  );
}
