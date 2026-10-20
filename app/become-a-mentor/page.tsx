import { Icon, ICONS, Vetted } from "@/components/ui";
import { MentorApplicationForm } from "@/components/MentorApplicationForm";
import { getSiteContent } from "@/lib/siteContentStore";
import { PageSections } from "@/components/website/PageSections";

export const metadata = { title: "Become a mentor · MentorsMD" };

const PERK_ICONS = [ICONS.pen, ICONS.lock, ICONS.calendar];

// The application form sits on this page (#apply); the old
// /become-a-mentor/apply address redirects here (next.config.js). The text
// is edited in Admin -> Website (defaults in lib/siteContent.ts).
export default async function BecomeMentorPage() {
  const c = await getSiteContent("becomeMentor");
  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <div className="stack" style={{ gap: 18 }}>
        <Vetted />
        <h1 className="page-title">{c.title}</h1>
        {c.intro && <p className="lede">{c.intro}</p>}
        <div className="row-wrap">
          <a href="#apply" className="btn btn-primary btn-lg">{c.applyButton}</a>
        </div>
      </div>
    ),
    perks: (
      <div className="grid-3">
        {c.perks.map((p, i) => (
          <div key={i} className="card card-tint stack-sm" style={{ gap: 10 }}>
            <span className="icon-dot" style={{ background: "#fff" }}><Icon d={PERK_ICONS[i % PERK_ICONS.length]} /></span>
            <b style={{ fontSize: 18 }}>{p.title}</b>
            <span className="text-secondary">{p.body}</span>
          </div>
        ))}
      </div>
    ),
    how: (
      <div className="card stack" style={{ gap: 14 }}>
        <h2 style={{ fontSize: 30 }}>{c.howTitle}</h2>
        {c.steps.length > 0 && (
          <ol className="stack-sm" style={{ margin: 0, paddingLeft: 20, fontSize: 16, lineHeight: 1.6 }}>
            {c.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        <div className="row-wrap">
          <a href="#apply" className="btn btn-primary btn-lg">{c.applyButton}</a>
          {c.inviteNote && <span className="text-secondary">{c.inviteNote}</span>}
        </div>
      </div>
    ),
    apply: (
      <section id="apply" className="stack" style={{ gap: 14, scrollMarginTop: 150 }}>
        <h2 style={{ fontSize: 36 }}>{c.applyTitle}</h2>
        {c.applyText && <p className="lede">{c.applyText}</p>}
        <div style={{ maxWidth: 720, width: "100%" }}>
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
