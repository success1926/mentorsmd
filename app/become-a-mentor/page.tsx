import { Callout, Icon, ICONS, SectionHead, Vetted } from "@/components/ui";
import { Steps } from "@/components/Steps";
import { MentorApplicationForm } from "@/components/MentorApplicationForm";
import { getSiteContent } from "@/lib/siteContentStore";
import { PageSections } from "@/components/website/PageSections";
import { SchoolMarquee } from "@/components/SchoolMarquee";

export const metadata = { alternates: { canonical: "/become-a-mentor" }, title: "Become a mentor", description: "Med students, residents, gap-year students and BS/MD undergrads: mentor the next class of doctors on MentorsMD. Set your own hourly rate; every mentor is interviewed by our senior team." };

const PERK_ICONS = [ICONS.pen, ICONS.lock, ICONS.calendar];

// The application form sits on this page (#apply); the old
// /become-a-mentor/apply address redirects here (next.config.js). The text
// is edited in Admin -> Website (defaults in lib/siteContent.ts).
export default async function BecomeMentorPage() {
  const [c, settings] = await Promise.all([getSiteContent("becomeMentor"), getSiteContent("siteSettings")]);
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <div className="stack become-intro">
        {!c.eyebrow && <Vetted />}
        <SectionHead as="h1" titleClassName="page-title" eyebrow={c.eyebrow} title={c.title} lede={c.intro} />
        <div className="row-wrap">
          <a href="#apply" className="btn btn-primary btn-lg">{c.applyButton} <span className="cue-arrow" aria-hidden="true">↓</span></a>
        </div>
      </div>
    ),
    // Same strip as the Homepage (Admin -> Website -> Site settings); hidden while empty.
    schoolLogos: settings.mentorSchools.length > 0 && <SchoolMarquee label={settings.mentorSchoolsTitle} schools={settings.mentorSchools} contained />,
    perks: (
      <div className="grid-3">
        {c.perks.map((p, i) => (
          <Callout
            key={i}
            title={
              <span className="perk-title">
                <span className="icon-dot icon-dot-white"><Icon d={PERK_ICONS[i % PERK_ICONS.length]} /></span>
                {p.title}
              </span>
            }
          >
            {p.body}
          </Callout>
        ))}
      </div>
    ),
    // How to join + the form (Nov 2026: the "how" box is now the top of
    // this section, so the steps sit right above the form they lead to).
    apply: (
      <section id="apply" className="stack apply-section anchor-target">
        <SectionHead title={c.applyTitle} lede={c.applyText} />
        {c.steps.length > 0 && (
          <div className="stack-sm apply-how">
            {c.howTitle && <h3 className="card-title">{c.howTitle}</h3>}
            <Steps steps={c.steps} variant="list" />
            {c.inviteNote && <span className="text-secondary">{c.inviteNote}</span>}
          </div>
        )}
        <div className="apply-form">
          <MentorApplicationForm />
        </div>
      </section>
    ),
  };
  return (
    <div className="page-mid">
      <div className="stack-lg">
        <PageSections page="becomeMentor" layout={c.layout} sections={sections} contained unit={24} />
      </div>
    </div>
  );
}
