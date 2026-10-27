import { isSafeHref, isSafeImage } from "@/lib/siteContent";
import { focusPosition, stripFocus } from "@/lib/imageFocus";

// A strip of school logos and names that scrolls sideways on its own (same
// as AdmitMD's). The schools are picked in Admin -> Website -> Site
// settings. Used for "Our mentors come from" (Homepage, Become a mentor)
// and "trained at" (Senior team).
//
//  - The list is drawn twice, so when the first copy has scrolled off the
//    second one is in exactly its place and the loop has no jump.
//  - Short lists are repeated so one pass is always wider than the screen.
//  - It pauses while the mouse is over it, and stays still (wrapping onto
//    more lines instead) for people who turned on "reduce motion".
//  - Nothing shows while the list is empty.
//  - contained: on the narrow pages (Senior team, Become a mentor) the
//    strip sits in the page's own column instead of a full-width band.

export type MarqueeSchool = { name: string; logo?: string; href?: string };

export function SchoolMarquee({ label, schools, contained }: { label: string; schools: MarqueeSchool[]; contained?: boolean }) {
  const list = schools.filter((s) => s.name?.trim());
  if (!list.length) return null;
  const items = Array.from({ length: Math.max(1, Math.ceil(12 / list.length)) }, () => list).flat();
  // Speed stays about the same however long the list is.
  const seconds = Math.max(20, items.length * 5);

  // Only the first copy of each school is read aloud or reachable with the
  // keyboard; the repeats are decoration.
  const Row = ({ copy }: { copy?: boolean }) => (
    <ul className="marquee-row" aria-hidden={copy || undefined}>
      {items.map((s, i) => {
        const repeat = copy || i >= list.length;
        const logo = s.logo && isSafeImage(s.logo) ? s.logo : "";
        const inner = (
          <>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stripFocus(logo)} alt="" width={40} height={40} loading="lazy" style={{ objectPosition: focusPosition(logo) }} />
            ) : (
              <span className="marquee-dot" aria-hidden="true" />
            )}
            <span>{s.name}</span>
          </>
        );
        const href = s.href && isSafeHref(s.href) ? s.href : "";
        const external = /^https?:/i.test(href);
        return (
          <li key={i} aria-hidden={(!copy && repeat) || undefined}>
            {href ? (
              <a href={href} tabIndex={repeat ? -1 : undefined} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {inner}
              </a>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className={`marquee-section${contained ? " marquee-contained" : ""}`} aria-label={label || "Schools"}>
      {label && <div className={contained ? "marquee-label" : "wrap marquee-label"}>{label}</div>}
      <div className="marquee" style={{ ["--marquee-time" as string]: `${seconds}s` }}>
        <div className="marquee-track">
          <Row />
          <Row copy />
        </div>
      </div>
    </section>
  );
}
