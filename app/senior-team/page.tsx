import Link from "next/link";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { SeniorTeamCards } from "@/components/SeniorTeamCards";
import { PageSections } from "@/components/website/PageSections";
import { Callout, SectionHead } from "@/components/ui";
import { SchoolMarquee } from "@/components/SchoolMarquee";

export const metadata = { alternates: { canonical: "/senior-team" }, title: "Our senior team", description: "Meet the MentorsMD senior team, who interview every mentor before they are invited to work with students." };

// The people who interview every mentor before they're invited. Names,
// photos and bios are edited in Admin -> Website (defaults: SENIOR_TEAM in
// lib/content.ts, via lib/siteContent.ts). The old /founders address
// redirects here (next.config.js). Laid out like the AdmitMD leadership
// cards: a card per person, the full bio opens in a pop-up.
export default async function SeniorTeamPage() {
  const [c, settings] = await Promise.all([getSiteContent("seniorTeam"), getSiteContent("siteSettings")]);
  const people = c.people.map((p) => ({
    name: p.name,
    title: p.title,
    creds: p.creds,
    photo: stripFocus(p.photo),
    photoPosition: focusPosition(p.photo, "50% 20%"),
    bio: paragraphs(p.bio),
    focus: p.focus,
  }));
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <SectionHead as="h1" titleClassName="page-title" eyebrow={c.eyebrow} title={c.title} lede={c.intro} />
    ),
    people: <SeniorTeamCards people={people} />,
    // Schools picked in Admin -> Website -> Site settings; hidden while empty.
    trainedAt: settings.trainedAt.length > 0 && <SchoolMarquee label={settings.trainedAtTitle} schools={settings.trainedAt} contained />,
    cta: (
      <Callout title={c.ctaTitle} action={<Link href="/become-a-mentor#apply" className="btn btn-primary btn-lg">{c.ctaButton}</Link>}>
        {c.ctaText}
      </Callout>
    ),
  };
  return (
    <div className="page">
      <div className="stack-lg public-stack">
        <PageSections page="seniorTeam" layout={c.layout} sections={sections} contained unit={24} />
      </div>
    </div>
  );
}
