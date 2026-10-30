import Link from "next/link";
import { LogoMark } from "./TopNav";
import { FooterAccountLink } from "./RoleCta";
import { getSiteContent } from "@/lib/siteContentStore";
import { isSafeHref } from "@/lib/siteContent";
import { hasReviewWall } from "@/lib/reviewWall";

// Same layout as the AdmitMD footer: a big logo centred on the left, link
// columns on the right, then a bottom row with social icons and contact
// details on the left and trust badges plus Privacy / Terms / copyright on
// the right. Links are in Title Case, as on AdmitMD. The
// tagline and social links are edited in Admin -> Website -> Footer, and
// the email and phone in Admin -> Website -> Contact. A social icon whose
// address is still blank shows greyed out as "coming soon".

const InstagramIcon = () => (
  <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
    <rect className="bg" width="36" height="36" rx="9" />
    <rect className="fg-line" x="9" y="9" width="18" height="18" rx="5.5" fill="none" strokeWidth="2.2" />
    <circle className="fg-line" cx="18" cy="18" r="4.3" fill="none" strokeWidth="2.2" />
    <circle className="fg" cx="23.3" cy="12.7" r="1.3" />
  </svg>
);
const TikTokIcon = () => (
  <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
    <rect className="bg" width="36" height="36" rx="7" />
    <path className="fg" d="M20.2 8h3.3c.3 2.6 1.9 4.3 4.5 4.6v3.4c-1.7 0-3.2-.5-4.5-1.4v6.9c0 3.9-2.8 6.5-6.4 6.5-3.5 0-6.1-2.6-6.1-5.9 0-3.6 3-6.3 6.9-5.8v3.5c-1.7-.4-3.4.6-3.4 2.3 0 1.4 1.1 2.4 2.6 2.4 1.7 0 3.1-1.1 3.1-3.3z" />
  </svg>
);
const LinkedInIcon = () => (
  <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
    <rect className="bg" width="36" height="36" rx="7" />
    <path className="fg" d="M10.2 14.4h3.4v11h-3.4zM11.9 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM15.7 14.4h3.3v1.5c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.1 2.3 4.1 5.3v6h-3.4v-5.3c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8v5.4h-3.4z" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
    <rect className="bg" width="36" height="36" rx="7" />
    <path className="fg" d="M9.5 9h5.4l4.4 6.1L24.7 9h2.6l-6.8 7.9L27.5 27h-5.4l-4.8-6.6L11.5 27H8.9l7.3-8.4zm3.6 1.8 10 14.4h1.9l-10-14.4z" />
  </svg>
);
const YouTubeIcon = () => (
  <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
    <rect className="bg" width="36" height="36" rx="7" />
    <rect className="fg" x="7" y="10.5" width="22" height="15" rx="4.5" />
    <path className="bg" d="M16 14.3v7.4l6.2-3.7z" />
  </svg>
);

const HELP_LINKS = [
  { label: "Personal Statements", href: "/mentors?service=PERSONAL_STATEMENT" },
  { label: "Secondary Essays", href: "/mentors?service=SECONDARIES" },
  { label: "MMI & Interview Prep", href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW" },
  { label: "MCAT Strategy", href: "/mentors?service=MCAT" },
  { label: "BS/MD Programs", href: "/mentors?best=BS_MD" },
  { label: "Reapplying", href: "/mentors?service=REAPPLICANT&bg=REAPPLICANT" },
];

const SOCIALS = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "tiktok", label: "TikTok", Icon: TikTokIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedInIcon },
  { key: "x", label: "X", Icon: XIcon },
  { key: "youtube", label: "YouTube", Icon: YouTubeIcon },
] as const;

export async function Footer() {
  const [c, contact, settings, showReviews] = await Promise.all([getSiteContent("footer"), getSiteContent("contact"), getSiteContent("siteSettings"), hasReviewWall()]);
  const phoneHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : "";
  return (
    <footer className="site-footer">
      <div className="wrap stack" style={{ gap: 44 }}>
        <div className="footer-top">
          <div className="footer-logo-wrap">
            <Link href="/" aria-label="MentorsMD home" className="footer-logo-link">
              <LogoMark size={120} />
              <span className="footer-wordmark">Mentors<b>MD</b></span>
              {c.tagline && <span className="footer-tagline">{c.tagline}</span>}
            </Link>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">For Students</div>
              <Link href="/mentors">Browse Mentors</Link>
              <Link href="/how-it-works">How It Works</Link>
              {showReviews && <Link href="/reviews">Reviews</Link>}
              <Link href="/gift">Gift MentorsMD</Link>
              <FooterAccountLink kind="student" />
            </div>
            {/* Topic links: what people search for, each opening Browse with that filter. */}
            <div className="footer-col">
              <div className="footer-col-title">Find Help With</div>
              {HELP_LINKS.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="footer-col">
              <div className="footer-col-title">MentorsMD</div>
              <Link href="/senior-team">Our Senior Team</Link>
              <Link href="/become-a-mentor">Become a Mentor</Link>
              <FooterAccountLink kind="mentor" />
              {/* Only once the Press page is switched on (Admin -> Website -> Site settings). */}
              {settings.showPress === "on" && <Link href="/press">Press</Link>}
              <Link href="/community-guidelines">Community Guidelines</Link>
              <Link href="/safety">Safety Tips</Link>
              <Link href="/contact">Contact Us</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-start">
            <div className="footer-socials" aria-label="MentorsMD on social media">
              {SOCIALS.map(({ key, label, Icon }) =>
                c[key] && isSafeHref(c[key]) ? (
                  <a key={key} href={c[key]} target="_blank" rel="noopener noreferrer" className="footer-social" aria-label={`MentorsMD on ${label} (opens in a new tab)`}>
                    <Icon />
                  </a>
                ) : (
                  <span key={key} className="footer-social is-soon" role="img" aria-label={`MentorsMD on ${label}, coming soon`} title={`${label}: coming soon`}>
                    <Icon />
                  </span>
                )
              )}
            </div>
            {(contact.email || contact.phone) && (
              <div className="footer-contact">
                {contact.phone && <a href={phoneHref}>{contact.phone}</a>}
                {contact.phone && contact.email && " · "}
                {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              </div>
            )}
          </div>
          <div className="footer-end">
            <div className="footer-trust">
              <span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                Payments Secured by Stripe
              </span>
              <span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                Every Mentor Interviewed
              </span>
            </div>
            <div className="footer-legal">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/mentor-agreement">Mentor Agreement</Link>
              <span>© {new Date().getFullYear()} MentorsMD</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
