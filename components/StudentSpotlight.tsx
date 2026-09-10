// Placeholder content - replace with real student outcomes once you have them.
const highlights = [
  { initials: "JA", color: "#1E5631", name: "Jordan A.", note: "Accepted to Johns Hopkins SOM, Class of 2030" },
  { initials: "MK", color: "#7C3AED", name: "Maya K.", note: "3 acceptances after a mock-interview session" },
  { initials: "DR", color: "#0D9488", name: "David R.", note: "Personal statement rewrite led to 5 interview invites" },
];

export function StudentSpotlight() {
  return (
    <div style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 22, textAlign: "center", marginBottom: 20 }}>Students who've made it</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {highlights.map((h) => (
          <div key={h.name} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: h.color, flexShrink: 0 }}>
              {h.initials}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{h.name}</div>
              <div className="text-secondary">{h.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
