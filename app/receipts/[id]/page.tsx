import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { receiptFor } from "@/lib/receipts";
import { money } from "@/lib/options";
import { siteUrl } from "@/lib/siteUrl";
import { tzOrDefault } from "@/lib/tz";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt", robots: { index: false } };

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="between" style={{ gap: 12, padding: "6px 0" }}>
      <span className={strong ? "" : "text-secondary"}>{strong ? <b>{label}</b> : label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{strong ? <b>{value}</b> : value}</span>
    </div>
  );
}

// One receipt, printable (student area v2, Oct 2026). Only the student who
// paid can open it: anyone else gets "not found".
export default async function ReceiptPage({ params, searchParams }: { params: { id: string }; searchParams: { stripe?: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== "BUYER") notFound();
  const r = await receiptFor(user.id, params.id);
  if (!r) notFound();
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, timeZone: true } });
  const tz = tzOrDefault(me?.timeZone);
  const when = r.date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" });
  const site = siteUrl().replace(/^https?:\/\//, "");

  return (
    <div className="page-narrow stack-lg receipt-page" style={{ gap: 20 }}>
      <div className="between no-print" style={{ flexWrap: "wrap", gap: 10 }}>
        <Link href="/receipts" className="link small">← All receipts</Link>
        <div className="row-wrap">
          <PrintButton />
          {r.stripeRef && <a href={`/api/receipts/${r.id}/stripe`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Stripe receipt</a>}
        </div>
      </div>
      {searchParams.stripe === "none" && <div className="alert no-print">Stripe&apos;s receipt isn&apos;t available for this payment. This page is your receipt.</div>}

      <article className="card stack" style={{ gap: 18 }}>
        <div className="between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div className="stack-sm" style={{ gap: 2 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>Mentors<b style={{ color: "var(--primary)" }}>MD</b></span>
            <span className="text-muted small">{site}</span>
          </div>
          <div className="stack-sm" style={{ gap: 2, textAlign: "right" }}>
            <b style={{ fontSize: 20 }}>Receipt</b>
            <span className="text-muted small">No. {r.id.toUpperCase()}</span>
            <span className="text-muted small">{when}</span>
          </div>
        </div>

        <div className="row-wrap" style={{ gap: 32, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="text-muted small">Sold by</span>
            <b>MentorsMD</b>
            <span className="small text-secondary">Mentor: {r.mentorName}</span>
          </div>
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="text-muted small">Billed to</span>
            <b>{me?.name}</b>
            <span className="small text-secondary">{me?.email}</span>
          </div>
          <div className="stack-sm" style={{ gap: 2 }}>
            <span className="text-muted small">Status</span>
            <b>{r.status}</b>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div className="between" style={{ gap: 12, padding: "6px 0", alignItems: "flex-start" }}>
            <span className="stack-sm" style={{ gap: 0 }}>
              <b>{r.title}</b>
              <span className="text-secondary small">{r.detail}</span>
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.totalCents)}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
          <Line label="Subtotal" value={money(r.totalCents)} />
          {r.creditAppliedCents > 0 && <Line label="MentorsMD credit applied" value={`−${money(r.creditAppliedCents)}`} />}
          <Line label="Paid by card" value={money(r.chargedCents)} strong />
          {r.refundedToCardCents > 0 && <Line label="Refunded to card" value={`−${money(r.refundedToCardCents)}`} />}
          {r.refundedAsCreditCents > 0 && <Line label="Refunded as MentorsMD credit" value={money(r.refundedAsCreditCents)} />}
        </div>

        <span className="text-muted small" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          Amounts in US dollars. Card payments are processed by Stripe. Unused hours aren&apos;t refunded; refunds on packages are made as MentorsMD credit, which never expires and can be used with any mentor.
        </span>
      </article>

      <div className="row-wrap no-print">
        <Link href={`/orders/${r.orderId}`} className="btn btn-sm">Open the package</Link>
        <Link href="/contact" className="btn btn-sm btn-ghost">Questions? Contact us</Link>
      </div>
    </div>
  );
}
