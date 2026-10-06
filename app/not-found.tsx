import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-narrow">
      <div className="center-head" style={{ padding: "60px 0" }}>
        <h1 className="page-title">We couldn&apos;t find that page.</h1>
        <p className="lede">It may have moved, or the link might be old.</p>
        <div className="row-wrap" style={{ justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">Go home</Link>
          <Link href="/mentors" className="btn">Browse mentors</Link>
        </div>
      </div>
    </div>
  );
}
