import Link from "next/link";

export const metadata = { title: "You're leaving MentorsMD", robots: { index: false } };

// Every link inside a message opens this page first (#42), so nobody
// lands on an outside site thinking it's part of MentorsMD.
function safeTarget(raw: string | undefined): URL | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

export default function LeavingPage({ searchParams }: { searchParams: { url?: string } }) {
  const target = safeTarget(searchParams?.url);
  return (
    <div className="page-narrow">
      <div className="card-narrow stack">
        <h1 className="page-title" style={{ fontSize: 34 }}>You&apos;re leaving MentorsMD</h1>
        {target ? (
          <>
            <p className="text-secondary" style={{ lineHeight: 1.6 }}>This link was shared in a message. It goes to:</p>
            <p className="evidence" style={{ fontWeight: 600 }}>{target.hostname}</p>
            <p className="text-muted small" style={{ wordBreak: "break-all" }}>{target.href}</p>
            <div className="alert alert-warning small">
              We don&apos;t control this site. Never enter a password (AMCAS, email or anything else) or pay for anything there. Payments for mentoring
              only happen on MentorsMD, where your payment is held until you approve.
            </div>
            <div className="row-wrap">
              <a href={target.href} className="btn btn-primary" rel="noopener noreferrer nofollow">Continue to {target.hostname}</a>
              <Link href="/messages" className="btn">Back to messages</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-secondary">This link isn&apos;t valid.</p>
            <Link href="/messages" className="btn" style={{ alignSelf: "flex-start" }}>Back to messages</Link>
          </>
        )}
      </div>
    </div>
  );
}
