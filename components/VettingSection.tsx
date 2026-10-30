import Link from "next/link";
import { paragraphs } from "@/lib/siteContent";
import type { PageValues } from "@/lib/siteContent";

// "Every mentor, vetted": a dark purple band with the heading and text on
// the left and the numbered points on the right. Used on the homepage and
// on /how-it-works; the text is edited in Admin -> Website -> Homepage
// (defaults in lib/siteContent.ts).

type Vet = Pick<PageValues<"home">, "vetEyebrow" | "vetTitle" | "vetText" | "vetLink" | "vetItems">;

export function VettingSection({ c, id }: { c: Vet; id?: string }) {
  return (
    <section id={id} className="vet-band" style={{ scrollMarginTop: 150 }}>
      <div className="wrap vet-grid">
        <div className="stack" style={{ gap: 18 }}>
          {c.vetEyebrow && <span className="eyebrow">{c.vetEyebrow}</span>}
          <h2 className="section-head">{c.vetTitle}</h2>
          {paragraphs(c.vetText).map((t, i) => (
            <p key={i} className="lede">{t}</p>
          ))}
          {c.vetLink && (
            <Link href="/senior-team" className="link" style={{ marginTop: 8 }}>
              {c.vetLink}
            </Link>
          )}
        </div>
        <div className="vet-items">
          {c.vetItems.map((v, i) => (
            <div key={i}>
              <span className="vet-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{v.title}</h3>
              {v.body && <p>{v.body}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
