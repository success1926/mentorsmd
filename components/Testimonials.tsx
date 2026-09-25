// Placeholder content - replace with real testimonials once you have them.
const testimonials = [
  {
    quote: "My coach caught things about my personal statement I never would have noticed myself. Worth every dollar.",
    name: "Priya S.",
    context: "Booked a personal statement review",
  },
  {
    quote: "The mock interview felt exactly like the real thing. I walked into my actual interview so much calmer.",
    name: "Alex T.",
    context: "Booked a mock interview session",
  },
  {
    quote: "Being able to message my coach before booking made it easy to know they actually understood what I needed.",
    name: "Sam O.",
    context: "Booked an application strategy session",
  },
];

export function Testimonials() {
  return (
    <div>
      <h2 className="section-title" style={{ marginBottom: 28 }}>What students are saying</h2>
      <div className="grid-3">
        {testimonials.map((t) => (
          <figure key={t.name} className="card" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 16, padding: 28 }}>
            <div aria-hidden="true" className="display" style={{ fontSize: 54, lineHeight: 0.5, height: 22, color: "var(--accent)" }}>&ldquo;</div>
            <blockquote className="display" style={{ margin: 0, fontSize: 20, lineHeight: 1.45, fontWeight: 400 }}>{t.quote}</blockquote>
            <figcaption className="text-secondary" style={{ fontSize: 14, marginTop: "auto" }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t.name}</span> · {t.context}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
