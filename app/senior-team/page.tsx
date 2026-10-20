import Link from "next/link";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { SeniorTeamCards } from "@/components/SeniorTeamCards";

export const metadata = { title: "Our senior team · MentorsMD" };

// The people who interview every mentor before they're invited. Names,
// photos and bios are edited in Admin -> Website (defaults: SENIOR_TEAM in
// lib/content.ts, via lib/siteContent.ts). The old /founders address
// redirects here (next.config.js). Laid out like the AdmitMD leadership
// cards: a card per person, the full bio opens in a pop-up.
export default async function SeniorTeamPage() {
  const c = await getSiteContent("seniorTeam");
  const people = c.people.map((p) => ({
    name: p.name,
    title: p.title,
    creds: p.creds,
    photo: stripFocus(p.photo),
    photoPosition: focusPosition(p.photo, "50% 20%"),
    bio: paragraphs(p.bio),
    focus: p.focus,
  }));
  return (
    <div className="page">
      <div className="stack-lg" style={{ gap: 48 }}>
        <div className="stack" style={{ gap: 14, maxWidth: 760 }}>
          <h1 className="page-title">{c.title}</h1>
          {c.intro && <p className="lede">{c.intro}</p>}
        </div>

        <SeniorTeamCards people={people} />

        <div className="card card-tint stack" style={{ gap: 12, alignItems: "flex-start" }}>
          <h2 style={{ fontSize: 24 }}>{c.ctaTitle}</h2>
          {c.ctaText && <p className="text-secondary">{c.ctaText}</p>}
          <Link href="/become-a-mentor#apply" className="btn btn-primary">{c.ctaButton}</Link>
        </div>
      </div>
    </div>
  );
}
