import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Unlike StudentSpotlight and Testimonials, this section is real data -
// it queries the same coaches who actually have profiles on the site, so
// there's nothing here to keep manually in sync as coaches join or leave.
export async function MentorSpotlight() {
  const mentors = await prisma.user.findMany({
    where: { role: "SELLER", gigs: { some: { active: true } } },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  if (mentors.length === 0) return null; // nothing to show yet if no coaches have joined

  return (
    <div style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 22, textAlign: "center", marginBottom: 20 }}>Meet a few of our mentors</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {mentors.map((m) => {
          const initials = m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <Link key={m.id} href={`/coaches/${m.id}`} className="card" style={{ display: "flex", gap: 14 }}>
              <div className="avatar" style={{ width: 48, height: 48, fontSize: 16, background: "#1E5631", flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="text-secondary" style={{ marginBottom: 6 }}>{m.credential}</div>
                {m.bio && (
                  <p className="text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                    {m.bio.length > 130 ? m.bio.slice(0, 130) + "..." : m.bio}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
