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
// point's position.
const PROTECT_ICONS = [ICONS.lock, ICONS.cycle, ICONS.video, ICONS.shield, ICONS.clock];

export default async function HowItWorksPage() {
  const [c, home] = await Promise.all([getSiteContent("howItWorks"), getSiteContent("home")]);
  // Each section by its id in lib/pageLayout.ts, shown in the order set in
  // Admin -> Website -> How it works -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <section className="wrap" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div className="center-head" style={{ gap: 20 }}>
          <h1 className="big-title">{c.title}</h1>
          {paragraphs(c.intro).map((p, i) => (
            <p key={i} className="lede" style={{ maxWidth: 820, fontSize: 21 }}>{p}</p>
          ))}
        </div>
      </section>
    ),

    steps: c.steps.length > 0 && (
        <section className="wrap" style={{ paddingBottom: 120 }}>
          {c.stepsTitle && <h2 style={{ fontSize: "clamp(30px, 3.6vw, 48px)", marginBottom: 36 }}>{c.stepsTitle}</h2>}
          <ol className="grid-4" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {c.steps.map((s, i) => (
              <li key={i} className="card card-tint stack-sm" style={{ gap: 10 }}>
                <span className="icon-dot display" style={{ background: "#fff", fontSize: 22, fontWeight: 600 }} aria-hidden="true">{i + 1}</span>
                <h3 style={{ fontSize: 21 }}>{s.title}</h3>
                {s.body && <p className="text-secondary" style={{ fontSize: 16, lineHeight: 1.6 }}>{s.body}</p>}
              </li>
            ))}
          </ol>
          <div className="row-wrap" style={{ marginTop: 32 }}>
            <Link href="/mentors" className="btn btn-primary btn-lg">Browse mentors</Link>
          </div>
        </section>
    ),

    // Same panel as the homepage (edited there).
    vetting: <VettingSection c={home} id="vetting" />,

    protection: (
      <section id="protection" className="wrap" style={{ paddingBottom: 120, scrollMarginTop: 150 }}>
        <div className="stack" style={{ gap: 14, marginBottom: 36 }}>
          <h2 style={{ fontSize: "clamp(30px, 3.6vw, 48px)" }}>{c.protectTitle}</h2>
          {c.protectText && <p className="lede" style={{ maxWidth: 760 }}>{c.protectText}</p>}
        </div>
        <div className="grid-4">
          {c.protectItems.map((p, i) => (
            <div key={i} className="vet-item">
              <span className="icon-dot"><Icon d={PROTECT_ICONS[i % PROTECT_ICONS.length]} size={22} /></span>
              <h3 style={{ fontSize: 21, marginTop: 4 }}>{p.title}</h3>
              {p.body && <p className="text-secondary" style={{ fontSize: 17 }}>{p.body}</p>}
            </div>
          ))}
        </div>
        <p className="text-secondary" style={{ marginTop: 32, fontSize: 17 }}>
          Read our <Link href="/safety" className="link">Safety tips</Link> and <Link href="/community-guidelines" className="link">Community Guidelines</Link>.
        </p>
      </section>
    ),

    // Same questions as the homepage (edited there).
    faq: <FaqSection title={home.faqTitle} faq={home.faq} />,

    cta: (
      <section className="home-section">
        <div className="wrap center-head" style={{ gap: 24 }}>
          <h2 className="big-title">{c.ctaTitle}</h2>
          {c.ctaText && <p className="lede" style={{ fontSize: 21, maxWidth: 760 }}>{c.ctaText}</p>}
          <div className="row-wrap" style={{ justifyContent: "center", gap: 14 }}>
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
