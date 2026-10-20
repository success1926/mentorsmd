import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditBalance, creditEntries } from "@/lib/credit";
import { CREDIT_REASON_LABEL } from "@/lib/hours";
import { money } from "@/lib/options";
import { tzOrDefault } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const metadata = { title: "MentorsMD credit" };

// MentorsMD credit (student area v2, Oct 2026): the balance and every
// change to it (lib/credit.ts). Credit never expires and is used
// automatically at checkout, with any mentor.
export default async function CreditPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return null; // middleware sends logged-out visitors to /login
  if (user.role !== "BUYER") {
    return (
      <div className="page-narrow">
        <div className="alert">MentorsMD credit is for student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }
  const [balance, entries, me] = await Promise.all([
    creditBalance(user.id),
    creditEntries(user.id, 200, { forStudent: true }),
    prisma.user.findUnique({ where: { id: user.id }, select: { timeZone: true } }),
  ]);
  const tz = tzOrDefault(me?.timeZone);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz });

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">MentorsMD credit</h1>
        <p className="lede">Used automatically at checkout, with any mentor. It never expires.</p>
      </div>

      <section className="card row-wrap" style={{ background: "var(--tint-soft)", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div className="stack-sm" style={{ gap: 4 }}>
          <span className="text-secondary">Your balance</span>
          <span className="stat-num">{money(balance)}</span>
        </div>
        <Link href="/mentors" className="btn btn-primary btn-sm">{balance > 0 ? "Use it with a mentor" : "Find a mentor"}</Link>
      </section>

      <section className="stack-sm">
        <h2 style={{ fontSize: 24 }}>History</h2>
        {entries.length === 0 ? (
          <p className="text-muted">
            No credit yet. If a package is refunded, the refund comes back to you as MentorsMD credit and shows here.
          </p>
        ) : (
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {entries.map((e) => (
              <div key={e.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 0, minWidth: 200 }}>
                  <b style={{ fontSize: 15 }}>
                    {CREDIT_REASON_LABEL[e.reason] || "Credit"}
                    {e.packageTitle ? ` · ${e.packageTitle}` : ""}
                  </b>
                  {e.note && e.reason !== "SPENT" && <span className="text-muted small">{e.note}</span>}
                </div>
                <span className="text-muted small nowrap">{fmt(e.createdAt)}</span>
                <b className="nowrap" style={{ minWidth: 80, textAlign: "right", color: e.amountCents > 0 ? "var(--success-fg)" : undefined }}>
                  {e.amountCents > 0 ? "+" : "−"}
                  {money(Math.abs(e.amountCents))}
                </b>
              </div>
            ))}
          </div>
        )}
      </section>

      <span className="text-muted small">
        Refunds on packages always come back as credit, never to the card. See what you paid on <Link href="/receipts" className="link">Receipts</Link>.
      </span>
    </div>
  );
}
