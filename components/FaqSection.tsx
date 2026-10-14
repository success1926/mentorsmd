import { paragraphs } from "@/lib/siteContent";

// The questions and answers from Admin -> Website -> Homepage -> Frequently
// asked questions. Used on the homepage and on /how-it-works; hidden while
// there are no questions.
export function FaqSection({ title, faq }: { title: string; faq: { question: string; answer: string }[] }) {
  if (faq.length === 0) return null;
  return (
    <section id="faq" style={{ paddingBottom: 40, scrollMarginTop: 150 }}>
      <div className="wrap" style={{ maxWidth: 900 }}>
        <h2 className="big-title" style={{ textAlign: "center", marginBottom: 48 }}>{title}</h2>
        <div>
          {faq.map((q, i) => (
            <details key={i} className="collapse">
              <summary style={{ fontSize: 18 }}>{q.question}</summary>
              <div className="collapse-body">
                {paragraphs(q.answer).map((a, j) => (
                  <p key={j} className="text-secondary" style={{ fontSize: 17, lineHeight: 1.6 }}>{a}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
