import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid #D8E2DC", marginTop: 40, padding: "24px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span className="text-muted">© {new Date().getFullYear()} MentorsMD</span>
        <div style={{ display: "flex", gap: 16 }}>
          <Link href="/terms" className="text-muted">Terms of Service</Link>
          <Link href="/privacy" className="text-muted">Privacy Policy</Link>
          <Link href="/contact" className="text-muted">Contact us</Link>
        </div>
      </div>
    </footer>
  );
}
