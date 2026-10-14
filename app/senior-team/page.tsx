import Link from "next/link";
import { Vetted } from "@/components/ui";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";

export const metadata = { title: "Our senior team · MentorsMD" };

// The people who interview every mentor before they're invited. Names,
// photos and bios are edited in Admin -> Website (defaults: SENIOR_TEAM in
// lib/content.ts, via lib/siteContent.ts). The old /founders address
// redirects here (next.config.js).
export default async function SeniorTeamPage() {
  const c = await getSiteContent("seniorTeam");
  return (
    <div className="page-mid">
      <div className="stack-lg">
        <div className="stack" style={{ gap: 18 }}>
          <Vetted />
          <h1 className="page-title">{c.title}</h1>
          {c.intro && <p className="lede">{c.intro}</p>}
        </div>

        <div className="stack-lg" style={{ gap: 56 }}>
          {c.people.map((p, i) => (
            <article key={i} className="team-member">
              {p.photo ? (
                <img
                  src={stripFocus(p.photo)}
                  alt={`Photo of ${p.name}`}
                  className="team-photo"
                  style={{ objectPosition: focusPosition(p.photo, "50% 20%") }}
                />
              ) : (
                <div className="team-photo" aria-hidden="true" />
              )}
              <div className="stack" style={{ gap: 12, minWidth: 0 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <h2 style={{ fontSize: 28 }}>{p.name}</h2>
                  {p.title && <span style={{ fontWeight: 600, color: "var(--primary)" }}>{p.title}</span>}
                  {p.creds && <span className="text-secondary">{p.creds}</span>}
                </div>
                {paragraphs(p.bio).map((para, i) => (
                  <p key={i} style={{ lineHeight: 1.65 }}>{para}</p>
                ))}
                {p.focus.length > 0 && (
                  <div className="row-wrap" style={{ gap: 8 }}>
                    {p.focus.map((f, j) => <span key={j} className="chip" style={{ fontSize: 14, padding: "6px 14px" }}>{f}</span>)}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="card card-tint stack" style={{ gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 24 }}>{c.ctaTitle}</h2>
          {c.ctaText && <p className="text-secondary">{c.ctaText}</p>}
          <Link href="/become-a-mentor#apply" className="btn btn-primary">{c.ctaButton}</Link>
        </div>
      </div>
    </div>
  );
}
