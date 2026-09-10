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
    <div style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 22, textAlign: "center", marginBottom: 20 }}>What students are saying</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {testimonials.map((t) => (
          <div key={t.name} className="card">
            <p style={{ lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>"{t.quote}"</p>
            <div className="text-secondary" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#33413A" }}>{t.name}</span> · {t.context}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
