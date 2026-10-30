import Link from "next/link";

export const metadata = { title: "Page Not Found" };

export default function NotFound() {
  return (
    <div className="page-narrow">
      <div className="center-head" style={{ padding: "60px 0" }}>
        <h1 className="page-title">We Couldn&apos;t Find That Page</h1>
        <p className="lede">It may have moved, or the link might be old.</p>
        <div className="row-wrap" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">Go Home</Link>
          <Link href="/mentors" className="btn">Browse Mentors</Link>
        </div>
      </div>
    </div>
  );
}
