import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteContent } from "@/lib/siteContentStore";
import { splitLead } from "@/lib/handbookContent";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Mentor Handbook", robots: { index: false } };
export const dynamic = "force-dynamic";

// What every mentor should know about working as a freelancer on MentorsMD:
// pricing without haggling, taxes, and working like a professional. Only
// logged-in mentors (and admins, for Admin -> Website's preview) can open
// it: /dashboard is a login-only path in middleware.ts, and anyone else is
// sent home here. Wording: Admin -> Website -> Mentor handbook
// (mentorHandbook in lib/siteContent.ts; defaults in lib/handbookContent.ts).
// In preview mode it shows the saved draft.

const slug = (s: string, i: number) => `s${i + 1}-` + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const paragraphs = (t: string) => t.split(/\n+/).map((p) => p.trim()).filter(Boolean);

export default async function MentorHandbookPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "SELLER" && role !== "ADMIN") redirect("/dashboard");

  const v = await getSiteContent("mentorHandbook");
  const sections = v.sections.filter((s) => s.title.trim());

  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <PageHeader title={v.title} />
        {paragraphs(v.intro).map((p) => <p key={p} className="lede">{p}</p>)}
        {sections.length > 1 && (
          <nav aria-label="On this page" style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
            {sections.map((s, i) => (
              <a key={i} href={`#${slug(s.title, i)}`} className="link">{s.title}</a>
            ))}
          </nav>
        )}
      </div>

      {sections.map((s, i) => (
        <section key={i} id={slug(s.title, i)} className="stack-sm" style={{ scrollMarginTop: 90 }}>
          <h2 className="block-title">{s.title}</h2>
          {paragraphs(s.intro).map((p) => <p key={p} className="text-secondary" style={{ lineHeight: 1.6 }}>{p}</p>)}
          {s.points.length > 0 && (
            <ul className="stack-sm text-secondary" style={{ paddingLeft: 20, lineHeight: 1.6 }}>
              {s.points.map((point, j) => {
                const { lead, text } = splitLead(point);
                return <li key={j}>{lead && <b style={{ color: "var(--ink)" }}>{lead}</b>}{lead && text ? " " : ""}{text}</li>;
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="card card-tint stack-sm">
        {v.helpTitle && <h2 className="card-title">{v.helpTitle}</h2>}
        {paragraphs(v.helpText).map((p) => <p key={p} className="text-secondary" style={{ lineHeight: 1.6 }}>{p}</p>)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
          <Link href="/contact" className="link">Contact us</Link>
          <Link href="/community-guidelines" className="link">Community Guidelines</Link>
          <Link href="/mentor-agreement" className="link">Mentor Agreement</Link>
          <Link href="/dashboard/offer-guide" className="link">Offer Guide</Link>
        </div>
      </section>
    </div>
  );
}
