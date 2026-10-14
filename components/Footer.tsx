import Link from "next/link";
import { LogoMark } from "./TopNav";
import { FooterAccountLink } from "./RoleCta";
import { getSiteContent } from "@/lib/siteContentStore";
import { isSafeHref } from "@/lib/siteContent";

// The tagline and social links are edited in Admin -> Website. A social
// link only shows once its address is filled in.
const SOCIALS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "youtube", label: "YouTube" },
] as const;

export async function Footer() {
  const c = await getSiteContent("footer");
  const socials = SOCIALS.filter((s) => c[s.key] && isSafeHref(c[s.key]));
  return (
    <footer className="site-footer">
      <div className="wrap stack-lg" style={{ gap: 48 }}>
        <div className="footer-grid">
          <div className="footer-col" style={{ gap: 14 }}>
            <span className="logo">
              <LogoMark />
              <span>Mentors<b>MD</b></span>
            </span>
            {c.tagline && <span className="text-secondary" style={{ fontSize: 17 }}>{c.tagline}</span>}
            {socials.length > 0 && (
              <nav aria-label="MentorsMD on social media" className="row-wrap" style={{ gap: 16, fontSize: 15 }}>
                {socials.map((s) => (
                  <a key={s.key} href={c[s.key]} target="_blank" rel="noopener noreferrer" className="text-secondary">
                    {s.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
          <div className="footer-col">
            <b>Students</b>
            <Link href="/mentors">Browse mentors</Link>
            <Link href="/#vetting">How we vet mentors</Link>
            <Link href="/#reviews">Reviews</Link>
            <FooterAccountLink kind="student" />
          </div>
          <div className="footer-col">
            <b>Mentors</b>
            <Link href="/become-a-mentor">Become a mentor</Link>
            <FooterAccountLink kind="mentor" />
          </div>
          <div className="footer-col">
            <b>Company</b>
            <Link href="/senior-team">Our senior team</Link>
            <Link href="/contact">Contact us</Link>
            <Link href="/community-guidelines">Community Guidelines</Link>
            <Link href="/safety">Safety tips</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
        <span className="text-secondary" style={{ fontSize: 14 }}>© {new Date().getFullYear()} MentorsMD</span>
      </div>
    </footer>
  );
}
