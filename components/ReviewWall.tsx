import { initialsOf } from "@/components/ui";
import { paragraphs } from "@/lib/siteContent";
import type { WallItem } from "@/lib/reviewWall";

// The grid of review cards, used by the homepage (#reviews) and /reviews.
// The data comes from getReviewWall() in lib/reviewWall.ts.
export function ReviewWall({ items }: { items: WallItem[] }) {
  return (
    <div className="wall-grid">
      {items.map((t, i) => (
        <div key={t.key}>
          <div className="testi">
            <div className="row" style={{ gap: 14 }}>
              <span className="avatar" style={{ width: 54, height: 54, background: ["#FCE4EC", "#E4EEFF", "#DDD5FF", "#F5B9CD"][i % 4] }}>
                {initialsOf(t.name)}
              </span>
              <span className="stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 18 }}>{t.name}</b>
                <span className="text-secondary">{t.detail}</span>
              </span>
            </div>
            <span className="stars">{"★".repeat(Math.round(t.rating))}</span>
            {(paragraphs(t.quote).length ? paragraphs(t.quote) : [""]).map((q, j) => (
              <p key={j} style={{ fontSize: 18, lineHeight: 1.55 }}>{q}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
