import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
          <span className="logo" style={{ fontSize: 20 }}>
            <span>
              Mentors<span className="logo-md">MD</span>
            </span>
          </span>
          <span className="text-secondary" style={{ fontSize: 15, lineHeight: 1.5 }}>
            Coaching from the people who just got in.
          </span>
          <span className="text-muted">© {new Date().getFullYear()} MentorsMD</span>
        </div>
        <div className="footer-cols">
          <div>
            <b>Students</b>
            <Link href="/coaches">Find a coach</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/signup/buyer">Create an account</Link>
          </div>
          <div>
            <b>Company</b>
            <Link href="/founders">About</Link>
            <Link href="/contact">Contact us</Link>
          </div>
          <div>
            <b>Legal</b>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
