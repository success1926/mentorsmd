// Placeholder content - swap in real photos, names, and bios.
// To add a photo: put the image file in /public (e.g. /public/founder-1.jpg)
// and replace the placeholder circle below with an <img src="/founder-1.jpg" .../>
const founders = [
  {
    initials: "JD",
    color: "#1E5631",
    name: "Jane Doe",
    title: "Co-Founder & CEO",
    bio: "Placeholder bio. A couple of sentences about her background, why she started MentorsMD, and what she's focused on now.",
  },
  {
    initials: "JS",
    color: "#7C3AED",
    name: "John Smith",
    title: "Co-Founder & COO",
    bio: "Placeholder bio. A couple of sentences about his background, why he started MentorsMD, and what he's focused on now.",
  },
];

export default function FoundersPage() {
  return (
    <div>
      <h1 style={{ fontSize: 26, textAlign: "center", marginBottom: 8 }}>Meet the founders</h1>
      <p className="text-secondary" style={{ textAlign: "center", maxWidth: 480, margin: "0 auto 40px" }}>
        {/* Placeholder copy - replace with your real story */}
        A short line about why we started MentorsMD.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${founders.length}, 1fr)`, gap: 24 }}>
        {founders.map((f) => (
          <div key={f.name} style={{ textAlign: "center" }}>
            {/* Photo placeholder - replace with an <img> tag once you have real photos */}
            <div
              className="avatar"
              style={{ width: 120, height: 120, fontSize: 36, background: f.color, margin: "0 auto 18px" }}
            >
              {f.initials}
            </div>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 2 }}>{f.name}</div>
            <div className="text-secondary" style={{ marginBottom: 14 }}>{f.title}</div>
            <p style={{ lineHeight: 1.6, textAlign: "left", color: "#33413A" }}>{f.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
