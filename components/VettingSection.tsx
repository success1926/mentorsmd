import Link from "next/link";
import { Icon, ICONS } from "@/components/ui";
import { paragraphs } from "@/lib/siteContent";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import type { PageValues } from "@/lib/siteContent";

// "Every mentor, vetted": the big panel plus the points under it. Used on
// the homepage and on /how-it-works; the text and photo are edited in
// Admin -> Website -> Homepage (defaults in lib/siteContent.ts). Icons
// follow each point's position.
const VET_ICONS = [ICONS.chat, ICONS.doc, ICONS.check, ICONS.star];

type Vet = Pick<PageValues<"home">, "vetTitle" | "vetText" | "vetLink" | "vetPhoto" | "vetItems">;

export function VettingSection({ c, id }: { c: Vet; id?: string }) {
  return (
    <section id={id} style={{ paddingBottom: 120, scrollMarginTop: 150 }}>
      <div className="wrap stack-lg" style={{ gap: 56 }}>
        <div className="vet-hero" style={c.vetPhoto ? { background: `linear-gradient(180deg, rgba(27,24,52,0.1), rgba(27,24,52,0.7)), url("${stripFocus(c.vetPhoto)}") ${c.vetPhoto.includes("#") ? focusPosition(c.vetPhoto) : "center"}/cover` } : undefined}>
          <h2>{c.vetTitle}</h2>
          {paragraphs(c.vetText).map((t, i) => (
            <p key={i}>{t}</p>
          ))}
          {c.vetLink && (
            <p>
              <Link href="/senior-team" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 4 }}>{c.vetLink}</Link>
            </p>
          )}
        </div>
        <div className="grid-4">
          {c.vetItems.map((v, i) => (
            <div key={i} className="vet-item">
              <span className="icon-dot"><Icon d={VET_ICONS[i % VET_ICONS.length]} size={22} /></span>
              <h3 style={{ fontSize: 21, marginTop: 4 }}>{v.title}</h3>
              <p className="text-secondary" style={{ fontSize: 17 }}>{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
