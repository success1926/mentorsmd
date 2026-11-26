import type { Metadata } from "next";
import Link from "next/link";
import { VettingSection } from "@/components/VettingSection";
import { FaqSection } from "@/components/FaqSection";
import { Icon, ICONS, SectionHead } from "@/components/ui";
import { Steps } from "@/components/Steps";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { PageSections } from "@/components/website/PageSections";

export const metadata: Metadata = { alternates: { canonical: "/how-it-works" },
  title: "How it works",
  description: "Find a vetted mentor, message them or book a free 15-minute intro call, then buy hours at their rate. Every hour is logged.",
};

// What MentorsMD is and how booking works. The intro, steps, protection
// points and closing box are edited in Admin -> Website -> How it works;
// the vetting panel and the questions come from Admin -> Website ->
// Homepage, so they stay the same on both pages. Icons follow each
// point's position. Spacing and headings match the homepage sections.
const PROTECT_ICONS = [ICONS.lock, ICONS.cycle, ICONS.video, ICONS.shield, ICONS.clock];

export default async function HowItWorksPage() {
  const [c, home] = await Promise.all([getSiteContent("howItWorks"), getSiteContent("home")]);
  // Each section by its id in lib/pageLayout.ts, shown in the order set in
  // Admin -> Website -> How it works -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <section className="home-section hiw-intro">
        <div className="wrap">
          <SectionHead
            center
            as="h1"
            titleClassName="page-title"
            eyebrow={c.eyebrow}
            title={c.title}
            lede={paragraphs(c.intro).length > 1 ? paragraphs(c.intro).map((p, i) => <span key={i} className="hiw-para">{p}</span>) : c.intro}
          />
        </div>
      </section>
    ),

    steps: c.steps.length > 0 && (
        <section className="home-section hiw-steps">
          <div className="wrap">
            {(c.stepsEyebrow || c.stepsTitle) && <SectionHead eyebrow={c.stepsEyebrow} title={c.stepsTitle} />}
            <div className="section-body">
              <Steps steps={c.steps} />
            </div>
          </div>
        </section>
    ),

    // Same panel as the homepage (edited there).
    vetting: <VettingSection c={home} id="vetting" />,

    protection: (
      <section id="protection" className="home-section anchor-target">
        <div className="wrap">
          <SectionHead eyebrow={c.protectEyebrow} title={c.protectTitle} lede={c.protectText} />
          {/* Two columns for 2 or 4 points, three otherwise, so no row is left half empty. */}
          <div className={`section-body feature-grid${c.protectItems.length % 3 !== 0 && c.protectItems.length % 2 === 0 ? " feature-grid-2" : ""}`}>
            {c.protectItems.map((p, i) => (
              <div key={i}>
                <span className="icon-dot icon-dot-44"><Icon d={PROTECT_ICONS[i % PROTECT_ICONS.length]} size={20} /></span>
                <h3>{p.title}</h3>
                {p.body && <p>{p.body}</p>}
              </div>
            ))}
          </div>
          <p className="text-secondary hiw-more">
            Read our <Link href="/community-guidelines" className="link">community guidelines</Link> and <Link href="/safety" className="link">safety summary</Link>.
          </p>
        </div>
      </section>
    ),

    // Same questions as the homepage (edited there).
    faq: <FaqSection title={home.faqTitle} faq={home.faq} />,

    // The one closing call to action (Browse mentors used to show twice).
    cta: (
      <section className="home-section home-cta">
        <div className="wrap center-head">
          <SectionHead center eyebrow={c.ctaEyebrow} title={c.ctaTitle} lede={c.ctaText} />
          <div className="row-wrap hiw-cta-btns">
            <Link href="/mentors" className="btn btn-primary btn-lg">Browse mentors</Link>
            <Link href="/become-a-mentor" className="btn btn-lg">Become a mentor</Link>
          </div>
        </div>
      </section>
    ),
  };

  return (
    <div>
      <PageSections page="howItWorks" layout={c.layout} sections={sections} />
    </div>
  );
}
