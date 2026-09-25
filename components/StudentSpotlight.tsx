// Placeholder content - replace with real student outcomes once you have them.
const highlights = [
  { initials: "JA", color: "var(--primary)", name: "Jordan A.", note: "Accepted to Johns Hopkins SOM, Class of 2030" },
  { initials: "MK", color: "var(--ink)", name: "Maya K.", note: "3 acceptances after a mock-interview session" },
  { initials: "DR", color: "var(--primary-deep)", name: "David R.", note: "Personal statement rewrite led to 5 interview invites" },
];

export function StudentSpotlight() {
  return (
    <div>
      <span className="eyebrow">Outcomes</span>
      <h2 className="section-title" style={{ margin: "10px 0 28px" }}>Students who've made it</h2>
      <div className="grid-3">
        {highlights.map((h) => (
          <div key={h.name} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: h.color, flexShrink: 0 }}>
              {h.initials}
            </div>
            <div>
              <div className="display" style={{ fontSize: 19 }}>{h.name}</div>
              <div className="text-secondary">{h.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
