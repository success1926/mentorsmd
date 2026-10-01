import Link from "next/link";
import { LogoMark } from "./TopNav";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap stack-lg" style={{ gap: 48 }}>
        <div className="footer-grid">
          <div className="footer-col" style={{ gap: 14 }}>
            <span className="logo">
              <LogoMark />
              MentorsMD
            </span>
            <span className="text-secondary" style={{ fontSize: 17 }}>Vetted mentors for the road to medical school.</span>
          </div>
          <div className="footer-col">
            <b>Students</b>
            <Link href="/coaches">Browse mentors</Link>
            <Link href="/#vetting">How we vet mentors</Link>
            <Link href="/#reviews">Reviews</Link>
            <Link href="/signup/buyer">Create an account</Link>
          </div>
          <div className="footer-col">
            <b>Mentors</b>
            <Link href="/become-a-mentor">Become a mentor</Link>
            <Link href="/login">Mentor login</Link>
          </div>
          <div className="footer-col">
            <b>Company</b>
            <Link href="/founders">About</Link>
            <Link href="/contact">Contact us</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
        <span className="text-secondary" style={{ fontSize: 14 }}>© {new Date().getFullYear()} MentorsMD</span>
      </div>
    </footer>
  );
}
