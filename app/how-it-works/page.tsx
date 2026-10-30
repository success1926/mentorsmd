import type { Metadata } from "next";
import Link from "next/link";
import { VettingSection } from "@/components/VettingSection";
import { FaqSection } from "@/components/FaqSection";
import { Icon, ICONS } from "@/components/ui";
import { paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { PageSections } from "@/components/website/PageSections";

export const metadata: Metadata = {
  title: "How It Works",
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
      <section className="home-section" style={{ paddingBottom: 72 }}>
        <div className="wrap center-head" style={{ gap: 16 }}>
          {c.eyebrow && <span className="eyebrow">{c.eyebrow}</span>}
          <h1 className="big-title">{c.title}</h1>
          {paragraphs(c.intro).map((p, i) => (
            <p key={i} className="lede" style={{ maxWidth: 760, marginTop: 8 }}>{p}</p>
          ))}
        </div>
      </section>
    ),

    steps: c.steps.length > 0 && (
        <section className="home-section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="stack" style={{ gap: 14, marginBottom: 40 }}>
              {c.stepsEyebrow && <span className="eyebrow">{c.stepsEyebrow}</span>}
              {c.stepsTitle && <h2 className="section-head">{c.stepsTitle}</h2>}
            </div>
            <ol className="step-grid">
              {c.steps.map((s, i) => (
                <li key={i}>
                  <span className="vet-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                </li>
              ))}
            </ol>
            <div className="row-wrap" style={{ marginTop: 40 }}>
              <Link href="/mentors" className="btn btn-primary btn-lg">Browse Mentors</Link>
            </div>
          </div>
        </section>
    ),

    // Same panel as the homepage (edited there).
    vetting: <VettingSection c={home} id="vetting" />,

    protection: (
      <section id="protection" className="home-section" style={{ scrollMarginTop: 150 }}>
        <div className="wrap">
          <div className="stack" style={{ gap: 14, marginBottom: 40 }}>
            {c.protectEyebrow && <span className="eyebrow">{c.protectEyebrow}</span>}
            <h2 className="section-head">{c.protectTitle}</h2>
            {c.protectText && <p className="lede" style={{ maxWidth: 760, marginTop: 4 }}>{c.protectText}</p>}
          </div>
          <div className="feature-grid">
            {c.protectItems.map((p, i) => (
              <div key={i}>
                <span className="icon-dot" style={{ width: 44, height: 44 }}><Icon d={PROTECT_ICONS[i % PROTECT_ICONS.length]} size={20} /></span>
                <h3>{p.title}</h3>
                {p.body && <p>{p.body}</p>}
              </div>
            ))}
          </div>
          <p className="text-secondary" style={{ marginTop: 32, fontSize: 16 }}>
            Read our <Link href="/safety" className="link">Safety Tips</Link> and <Link href="/community-guidelines" className="link">Community Guidelines</Link>.
          </p>
        </div>
      </section>
    ),

    // Same questions as the homepage (edited there).
    faq: <FaqSection title={home.faqTitle} faq={home.faq} />,

    cta: (
      <section className="home-section home-cta">
        <div className="wrap center-head" style={{ gap: 20 }}>
          {c.ctaEyebrow && <span className="eyebrow">{c.ctaEyebrow}</span>}
          <h2 className="big-title">{c.ctaTitle}</h2>
          {c.ctaText && <p className="lede" style={{ maxWidth: 760 }}>{c.ctaText}</p>}
          <div className="row-wrap" style={{ justifyContent: "center", gap: 12, marginTop: 8 }}>
            <Link href="/mentors" className="btn btn-primary btn-lg">Browse Mentors</Link>
            <Link href="/become-a-mentor" className="btn btn-lg">Become a Mentor</Link>
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
