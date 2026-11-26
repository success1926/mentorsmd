import { paragraphs } from "@/lib/siteContent";
import { Collapsible } from "@/components/ui";

export type FaqItem = { question: string; answer: string };

// One look for every list of questions: the homepage / How it works
// questions (Admin -> Website -> Homepage) and any added FAQ section
// (components/website/PageSections.tsx). Hidden while empty.
export function Faq({ title, faq, center = true }: { title?: string; faq: FaqItem[]; center?: boolean }) {
  const qs = faq.filter((q) => q?.question);
  if (!qs.length && !title) return null;
  return (
    <div className={`faq${center ? " is-center" : ""}`}>
      {title && <h2 className="section-title faq-title">{title}</h2>}
      <div>
        {qs.map((q, i) => (
          <Collapsible key={i} title={q.question}>
            {paragraphs(q.answer).map((a, j) => (
              <p key={j} className="faq-answer">{a}</p>
            ))}
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

// The homepage and /how-it-works section (#faq).
export function FaqSection({ title, faq }: { title: string; faq: FaqItem[] }) {
  if (faq.length === 0) return null;
  return (
    <section id="faq" className="faq-section">
      <div className="wrap">
        <Faq title={title} faq={faq} />
      </div>
    </section>
  );
}
