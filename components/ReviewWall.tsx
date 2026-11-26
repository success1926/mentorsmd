import { initialsOf, Stars, TINTS } from "@/components/ui";
import { RevealWall } from "@/components/RevealWall";
import { paragraphs } from "@/lib/siteContent";
import type { WallItem } from "@/lib/reviewWall";

// The grid of review cards, used by the homepage (#reviews) and /reviews.
// The data comes from getReviewWall() in lib/reviewWall.ts. `rail` (the
// homepage): on phones the same cards become a sideways row you swipe
// (CSS only, .wall-grid-rail in app/styles/public.css) instead of one very
// long column; /reviews keeps the full wall for reading. Rendered once.
export function ReviewWall({ items, rail = false }: { items: WallItem[]; rail?: boolean }) {
  return (
    <RevealWall className={rail ? "wall-grid-rail" : undefined}>
      {items.map((t, i) => (
        <ReviewCard key={t.key} t={t} i={i} />
      ))}
    </RevealWall>
  );
}

function ReviewCard({ t, i }: { t: WallItem; i: number }) {
  return (
    <div>
      <div className="testi">
        <div className="row testi-head">
          <span className="avatar testi-avatar" style={{ background: TINTS[(i + 1) % TINTS.length] }}>
            {initialsOf(t.name)}
          </span>
          <span className="stack-sm testi-who">
            <b>{t.name}</b>
            <span className="text-secondary">{t.detail}</span>
          </span>
        </div>
        <Stars value={t.rating} showValue={false} />
        {(paragraphs(t.quote).length ? paragraphs(t.quote) : [""]).map((q, j) => (
          <p key={j} className="testi-quote">{q}</p>
        ))}
      </div>
    </div>
  );
}
