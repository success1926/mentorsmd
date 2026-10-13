import Link from "next/link";
import { Vetted } from "@/components/ui";
import { SENIOR_TEAM } from "@/lib/content";

export const metadata = { title: "Our senior team · MentorsMD" };

// The people who interview every mentor before they're invited. Names,
// photos and bios live in lib/content.ts (SENIOR_TEAM). The old /founders
// address redirects here (next.config.js).
export default function SeniorTeamPage() {
  return (
    <div className="page-mid">
      <div className="stack-lg">
        <div className="stack" style={{ gap: 18 }}>
          <Vetted />
          <h1 className="page-title">Our senior team.</h1>
          <p className="lede">
            Every MentorsMD mentor goes through a rigorous interview with each of us before they&apos;re invited, so students know anyone they message has real experience and outstanding results.
          </p>
        </div>

        <div className="stack-lg" style={{ gap: 56 }}>
          {SENIOR_TEAM.map((p) => (
            <article key={p.name} className="team-member">
              <img
                src={p.photo}
                alt={`Photo of ${p.name}`}
                className="team-photo"
                style={{ objectPosition: p.photoPosition || "50% 20%" }}
                loading="lazy"
              />
              <div className="stack" style={{ gap: 12, minWidth: 0 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <h2 style={{ fontSize: 28 }}>{p.name}</h2>
                  <span style={{ fontWeight: 600, color: "var(--primary)" }}>{p.title}</span>
                  {p.creds && <span className="text-secondary">{p.creds}</span>}
                </div>
                {p.bio.map((para, i) => (
                  <p key={i} style={{ lineHeight: 1.65 }}>{para}</p>
                ))}
                {p.focus.length > 0 && (
                  <div className="row-wrap" style={{ gap: 8 }}>
                    {p.focus.map((f) => <span key={f} className="chip" style={{ fontSize: 14, padding: "6px 14px" }}>{f}</span>)}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="card card-tint stack" style={{ gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 24 }}>Want to mentor with us?</h2>
          <p className="text-secondary">Med students and residents can apply. If it looks like a fit, you&apos;ll interview with each of us.</p>
          <Link href="/become-a-mentor#apply" className="btn btn-primary">Apply to mentor</Link>
        </div>
      </div>
    </div>
  );
}
