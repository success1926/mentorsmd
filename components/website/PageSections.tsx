import { Fragment } from "react";
import Link from "next/link";
import { paragraphs, safeHref, isSafeImage } from "@/lib/siteContent";
import { sectionLabel, sectionsFor, videoEmbedUrl, type LayoutItem, type Space } from "@/lib/pageLayout";
import { focusPosition, stripFocus } from "@/lib/imageFocus";

// Renders a page's sections in the order saved in Admin -> Website ->
// (page) -> Layout, skipping hidden ones, with the chosen space above, and
// including any added sections. With no saved layout this is the page's
// built-in order, so visitors see exactly the page as coded.
//
// Before each section goes an invisible marker (<i hidden data-edit-sec>)
// so admins get an "Edit" button on it (components/website/SiteEditButtons.tsx).
// Visitors' pages look and behave the same.

type Props = {
  page: string;
  layout: LayoutItem[];
  sections: Record<string, React.ReactNode>;
  // Narrow pages (contact, senior team…): added sections sit in the page's
  // own column instead of a full-width band.
  contained?: boolean;
  // Base unit for "space above" (more = 1 unit, much more = 2.5, less = -1).
  unit?: number;
  // Homepage: the top bar floats over the first section, so if something
  // other than the hero comes first it gets room for the bar.
  navGap?: string;
};

const SPACE_FACTOR: Record<Space, number> = { less: -1, more: 1, most: 2.5 };

export function PageSections({ page, layout, sections, contained, unit = 48, navGap }: Props) {
  const items = layout.filter((i) => !i.hidden);
  const builtins = sectionsFor(page);
  return (
    <>
      {items.map((item, idx) => {
        const builtin = builtins.find((b) => b.id === item.id);
        const node = builtin ? sections[item.id] : <AddonSection item={item} contained={!!contained} />;
        if (node === undefined || node === null || node === false) return null;
        // Edits for some sections happen on another page (How it works shows the Homepage's vetting panel).
        const target = builtin?.editOn ?? { page, section: item.id };
        const marker = (
          <i
            hidden
            data-edit-sec={target.section}
            data-edit-page={target.page}
            data-edit-label={sectionLabel(page, item).replace(/\s*\(.*\)$/, "")}
            data-edit-addon={builtin ? undefined : "1"}
          />
        );
        let body = node;
        if (navGap && idx === 0 && item.id !== navGap) body = <div className="home-nav-gap">{body}</div>;
        if (item.space) body = <div style={{ marginTop: SPACE_FACTOR[item.space] * unit }}>{body}</div>;
        return (
          <Fragment key={item.id}>
            {marker}
            {body}
          </Fragment>
        );
      })}
    </>
  );
}

// ---- added sections ---------------------------------------------------------

function Band({ contained, children }: { contained: boolean; children: React.ReactNode }) {
  if (contained) return <section className="addon">{children}</section>;
  return (
    <section className="addon addon-band">
      <div className="wrap">{children}</div>
    </section>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function AddonSection({ item, contained }: { item: LayoutItem; contained: boolean }) {
  const d = item.data ?? {};
  switch (item.type) {
    case "text": {
      if (!str(d.title) && !str(d.body)) return null;
      return (
        <Band contained={contained}>
          <div className="stack" style={{ gap: 16, maxWidth: 820 }}>
            {str(d.title) && <h2 className="addon-title">{str(d.title)}</h2>}
            {paragraphs(str(d.body)).map((p, i) => (
              <p key={i} className="lede">{p}</p>
            ))}
          </div>
        </Band>
      );
    }
    case "mediaText": {
      const image = str(d.image);
      const href = str(d.buttonHref);
      return (
        <Band contained={contained}>
          <div className={`addon-media${d.side === "right" ? " addon-media-right" : ""}`}>
            {image && isSafeImage(image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="addon-media-img" src={stripFocus(image)} alt="" loading="lazy" style={{ objectPosition: focusPosition(image) }} />
            ) : (
              <div className="addon-media-img addon-media-empty" aria-hidden="true" />
            )}
            <div className="stack" style={{ gap: 16 }}>
              {str(d.title) && <h2 className="addon-title">{str(d.title)}</h2>}
              {paragraphs(str(d.body)).map((p, i) => (
                <p key={i} className="lede">{p}</p>
              ))}
              {str(d.buttonLabel) && href && (
                <div className="row-wrap">
                  <Link href={safeHref(href)} className="btn btn-primary btn-lg">{str(d.buttonLabel)}</Link>
                </div>
              )}
            </div>
          </div>
        </Band>
      );
    }
    case "faq": {
      const qs = (Array.isArray(d.items) ? d.items : []).filter((q: any) => str(q?.question));
      if (!qs.length && !str(d.title)) return null;
      return (
        <Band contained={contained}>
          <div style={{ maxWidth: 900, margin: contained ? undefined : "0 auto" }}>
            {str(d.title) && <h2 className="addon-title" style={{ marginBottom: 32, textAlign: contained ? undefined : "center" }}>{str(d.title)}</h2>}
            <div>
              {qs.map((q: any, i: number) => (
                <details key={i} className="collapse">
                  <summary style={{ fontSize: 18 }}>{str(q.question)}</summary>
                  <div className="collapse-body">
                    {paragraphs(str(q.answer)).map((a, j) => (
                      <p key={j} className="text-secondary" style={{ fontSize: 17, lineHeight: 1.6 }}>{a}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </Band>
      );
    }
    case "cta": {
      const href = str(d.buttonHref);
      return (
        <Band contained={contained}>
          <div className="addon-cta">
            <div className="stack" style={{ gap: 10, flex: 1, minWidth: 240 }}>
              {str(d.title) && <h2 className="addon-title" style={{ color: "#fff" }}>{str(d.title)}</h2>}
              {paragraphs(str(d.text)).map((p, i) => (
                <p key={i} style={{ fontSize: 18, lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>{p}</p>
              ))}
            </div>
            {str(d.buttonLabel) && href && <Link href={safeHref(href)} className="btn btn-lg addon-cta-btn">{str(d.buttonLabel)}</Link>}
          </div>
        </Band>
      );
    }
    case "video": {
      const src = videoEmbedUrl(str(d.url));
      if (!src) return null;
      return (
        <Band contained={contained}>
          <div className="stack" style={{ gap: 20, maxWidth: 960, margin: contained ? undefined : "0 auto" }}>
            {str(d.title) && <h2 className="addon-title">{str(d.title)}</h2>}
            <div className="addon-video">
              <iframe
                src={src}
                title={str(d.title) || "Video"}
                loading="lazy"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            {paragraphs(str(d.caption)).map((p, i) => (
              <p key={i} className="text-secondary" style={{ fontSize: 17 }}>{p}</p>
            ))}
          </div>
        </Band>
      );
    }
    case "logos": {
      const logos = (Array.isArray(d.logos) ? d.logos : []).filter((l: any) => str(l?.image) && isSafeImage(str(l.image)));
      if (!logos.length) return null;
      return (
        <Band contained={contained}>
          <div className="addon-logos">
            {str(d.label) && <span className="addon-logos-label">{str(d.label)}</span>}
            <div className="addon-logos-row">
              {logos.map((l: any, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={stripFocus(str(l.image))} alt={str(l.name)} loading="lazy" />
              ))}
            </div>
          </div>
        </Band>
      );
    }
    default:
      return null;
  }
}
