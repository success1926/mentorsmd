import Link from "next/link";
import { SectionHead } from "@/components/ui";

export const metadata = { title: "Page not found", robots: { index: false } };

// The 404 page: the homepage's soft colour blobs behind a short message,
// the two main ways back, and a few useful pages.
export default function NotFound() {
  return (
    <section className="notfound">
      <div className="blob notfound-blob-1" />
      <div className="blob notfound-blob-2" />
      <div className="blob notfound-blob-3" />
      <div className="page-narrow notfound-in">
        <div className="center-head">
          <SectionHead center as="h1" titleClassName="page-title" eyebrow="Page not found" title="We couldn't find that page" lede="It may have moved, or the link might be old." />
          <div className="row-wrap notfound-btns">
            <Link href="/" className="btn btn-primary btn-lg">Go home</Link>
            <Link href="/mentors" className="btn btn-lg">Browse mentors</Link>
          </div>
          <p className="text-secondary">
            Or try <Link href="/how-it-works" className="link">How it works</Link>, <Link href="/senior-team" className="link">our senior team</Link> or{" "}
            <Link href="/contact" className="link">contact us</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
