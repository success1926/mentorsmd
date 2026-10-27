import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSafeHref, isSafeImage, paragraphs } from "@/lib/siteContent";
import { getSiteContent } from "@/lib/siteContentStore";
import { currentAdmin } from "@/lib/adminTeam";
import { stripFocus } from "@/lib/imageFocus";
import { PageSections } from "@/components/website/PageSections";

export const dynamic = "force-dynamic"; // who's looking decides whether the page exists

// The Press page (like AdmitMD's). The text and the press mentions are
// edited in Admin -> Website -> Press. There's no press yet, so the page
// is off until "Press page" is switched on in Admin -> Website -> Site
// settings: until then visitors get "page not found", it isn't linked
// anywhere, and admins with the Website permission can still open it
// (with a note at the top) to get it ready.

async function pressVisible() {
  const settings = await getSiteContent("siteSettings");
  return settings.showPress === "on";
}

export async function generateMetadata(): Promise<Metadata> {
  const visible = await pressVisible();
  return { title: "Press · MentorsMD", robots: visible ? undefined : { index: false, follow: false } };
}

export default async function PressPage() {
  const visible = await pressVisible();
  if (!visible && !(await currentAdmin("website").catch(() => null))) notFound();
  const [c, contact] = await Promise.all([getSiteContent("press"), getSiteContent("contact")]);

  // Sections by id (lib/pageLayout.ts), in the order set in Admin -> Website -> Layout.
  const sections: Record<string, React.ReactNode> = {
    intro: (
      <div className="stack" style={{ gap: 14, maxWidth: 760 }}>
        <h1 className="page-title">{c.title}</h1>
        {c.intro && <p className="lede">{c.intro}</p>}
      </div>
    ),
    items: c.items.length ? (
      <div className="grid-2">
        {c.items.map((p, i) => {
          const href = p.href && isSafeHref(p.href) ? p.href : "";
          const body = (
            <>
              {p.logo && isSafeImage(p.logo) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="press-logo" src={stripFocus(p.logo)} alt="" loading="lazy" />
              )}
              <span className="press-meta">
                {p.outlet}
                {p.date ? ` · ${p.date}` : ""}
              </span>
              <span className="press-headline">{p.headline}</span>
              {paragraphs(p.quote).map((q, j) => (
                <blockquote key={j} className="press-quote">{q}</blockquote>
              ))}
              {href && <span className="press-more">Read the piece ↗</span>}
            </>
          );
          return href ? (
            <a key={i} href={href} className="card press-card" target="_blank" rel="noopener noreferrer">
              {body}
            </a>
          ) : (
            <div key={i} className="card press-card">{body}</div>
          );
        })}
      </div>
    ) : (
      c.emptyText && <div className="empty">{c.emptyText}</div>
    ),
    contact: (c.contactTitle || c.contactText) && (
      <div className="card card-tint stack" style={{ gap: 10, alignItems: "flex-start" }}>
        {c.contactTitle && <h2 style={{ fontSize: 24 }}>{c.contactTitle}</h2>}
        {c.contactText && <p className="text-secondary">{c.contactText}</p>}
        {contact.email && <a className="link" href={`mailto:${contact.email}`}>{contact.email}</a>}
      </div>
    ),
  };

  return (
    <div className="page">
      <div className="stack-lg" style={{ gap: 48 }}>
        {!visible && (
          <div role="status" className="alert alert-warning">
            <b>Only admins can see this page.</b> Visitors get “page not found” until you switch on “Press page” in Admin → Website → Site settings.
          </div>
        )}
        <PageSections page="press" layout={c.layout} sections={sections} contained unit={24} />
      </div>
    </div>
  );
}
