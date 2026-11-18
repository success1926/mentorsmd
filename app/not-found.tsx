import Link from "next/link";

export const metadata = { title: "Page Not Found", robots: { index: false } };

// The 404 page: the homepage's soft colour blobs behind a short message,
// the two main ways back, and a few useful pages.
export default function NotFound() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div className="blob" style={{ left: -140, top: 160, width: 460, height: 240, background: "rgba(228,238,255,0.9)", filter: "blur(50px)" }} />
      <div className="blob" style={{ right: -100, top: 60, width: 480, height: 260, background: "rgba(245,185,205,0.45)", filter: "blur(60px)" }} />
      <div className="blob" style={{ left: "30%", top: 0, width: 460, height: 180, background: "rgba(207,196,255,0.45)", filter: "blur(60px)" }} />
      <div className="page-narrow" style={{ position: "relative" }}>
        <div className="center-head" style={{ padding: "72px 0 56px" }}>
          <span className="eyebrow">Page Not Found</span>
          <h1 className="page-title">We Couldn&apos;t Find That Page</h1>
          <p className="lede">It may have moved, or the link might be old.</p>
          <div className="row-wrap" style={{ justifyContent: "center" }}>
            <Link href="/" className="btn btn-primary btn-lg">Go Home</Link>
            <Link href="/mentors" className="btn btn-lg">Browse Mentors</Link>
          </div>
          <p className="text-secondary" style={{ marginTop: 8 }}>
            Or try <Link href="/how-it-works" className="link">How It Works</Link>, <Link href="/senior-team" className="link">Our Senior Team</Link> or{" "}
            <Link href="/contact" className="link">Contact Us</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
