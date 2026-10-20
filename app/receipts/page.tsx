import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { receiptsFor } from "@/lib/receipts";
import { money } from "@/lib/options";
import { prisma } from "@/lib/prisma";
import { tzOrDefault } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipts" };

const fmtDate = (d: Date, timeZone: string) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Paid" ? "badge-success" : status.startsWith("Refunded") ? "badge-blue" : "badge-warning";
  return <span className={`badge ${tone}`}>{status}</span>;
}

// Receipts (student area v2, Oct 2026): every payment the student made -
// packages, hour bundles, hourly, pay-per-call and added hours - with
// credit applied, refunds, and a link to Stripe's own receipt (lib/receipts.ts).
export default async function ReceiptsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) return null; // middleware sends logged-out visitors to /login
  if (user.role !== "BUYER") {
    return (
      <div className="page-narrow">
        <div className="alert">Receipts are for student accounts. <Link href="/" className="link">Go home</Link></div>
      </div>
    );
  }
  const [receipts, me] = await Promise.all([receiptsFor(user.id), prisma.user.findUnique({ where: { id: user.id }, select: { timeZone: true } })]);
  const tz = tzOrDefault(me?.timeZone);
  const paidByCard = receipts.reduce((s, r) => s + r.chargedCents - r.refundedToCardCents, 0);

  return (
    <div className="page-mid stack-lg" style={{ gap: 24 }}>
      <div className="stack-sm">
        <h1 className="page-title">Receipts</h1>
        <p className="lede">Every payment you&apos;ve made on MentorsMD: packages and added hours.</p>
      </div>

      {receipts.length === 0 ? (
        <div className="empty stack" style={{ alignItems: "center" }}>
          <b>No payments yet</b>
          <span className="text-secondary">When you buy hours or a package from a mentor, the receipt shows here.</span>
          <Link href="/mentors" className="btn btn-primary btn-sm">Find a mentor</Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>Mentor</th>
                  <th className="num">Amount</th>
                  <th className="num">Credit applied</th>
                  <th className="num">Paid by card</th>
                  <th>Status</th>
                  <th><span className="sr-only">Receipt</span></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date, tz)}</td>
                    <td className="wrap-cell">
                      <Link href={`/receipts/${r.id}`} className="link"><b>{r.title}</b></Link>
                      <span className="text-muted small" style={{ display: "block" }}>{r.detail}</span>
                    </td>
                    <td>{r.mentorName}</td>
                    <td className="num">{money(r.totalCents)}</td>
                    <td className="num">{r.creditAppliedCents > 0 ? `−${money(r.creditAppliedCents)}` : "—"}</td>
                    <td className="num"><b>{money(r.chargedCents)}</b></td>
                    <td>
                      <StatusBadge status={r.status} />
                      {r.refundedAsCreditCents > 0 && r.refundedAsCreditCents < r.totalCents && <span className="text-muted small" style={{ display: "block" }}>{money(r.refundedAsCreditCents)} as credit</span>}
                    </td>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <Link href={`/receipts/${r.id}`} className="link small">View</Link>
                        {r.stripeRef && <a href={`/api/receipts/${r.id}/stripe`} target="_blank" rel="noopener noreferrer" className="link small">Stripe receipt</a>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-muted small">
            Paid by card in total: <b>{money(paidByCard)}</b>. Card payments go through Stripe, which also emails you a receipt. Refunds on packages are made as{" "}
            <Link href="/credit" className="link">MentorsMD credit</Link>, which never expires.
          </span>
        </>
      )}

      <div className="card stack-sm" style={{ background: "var(--tint-soft)" }}>
        <b>Need help with a payment?</b>
        <span className="text-secondary small">Message your mentor first, or <Link href="/contact" className="link">contact us</Link>.</span>
      </div>
    </div>
  );
}
