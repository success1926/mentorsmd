import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { confirmGiftFromStripe, giftByViewToken, giftLine } from "@/lib/gifts";
import { GIFT_STATUS_LABEL } from "@/lib/giftOptions";
import { hoursSummary, shortHours } from "@/lib/hours";
import { money } from "@/lib/options";
import { tzOrDefault } from "@/lib/tz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your gift · MentorsMD", robots: { index: false } };

const fmtDay = (d: Date, tz?: string) => d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });
const ORDER_STATUS: Record<string, string> = {
  IN_ESCROW: "In progress",
  COMPLETED: "Completed",
  RELEASED: "Completed",
  REFUNDED: "Refunded as MentorsMD credit",
};

// The private page of a parent who bought a gift (lib/gifts.ts), from the
// link in their receipt email (no account). What was bought, for whom,
// the receipt, and for a package the hours used and left and the calls,
// never any messages. Same look as the consenting parent's page
// (/parent/<token>).
export default async function GiftParentPage({ params, searchParams }: { params: { token: string }; searchParams: { paid?: string; stripe?: string } }) {
  let gift = await giftByViewToken(params.token);
  if (!gift) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>This link isn&apos;t active</h1>
          <p className="text-secondary">Check you copied the whole link from your receipt email. Contact us if you need help.</p>
          <Link href="/contact" className="link">Contact us</Link>
        </div>
      </div>
    );
  }
  // Just back from Stripe: if the webhook hasn't run yet, check the payment ourselves.
  if (gift.status === "PENDING" && searchParams.paid) {
    await confirmGiftFromStripe(gift);
    gift = (await giftByViewToken(params.token))!;
  }

  const [student, order] = await Promise.all([
    gift.studentId ? prisma.user.findUnique({ where: { id: gift.studentId }, select: { timeZone: true, passwordHash: true, minorStatus: true, _count: { select: { accounts: true } } } }) : null,
    gift.orderId
      ? prisma.order.findUnique({
          where: { id: gift.orderId },
          select: {
            id: true, status: true, minutesPurchased: true, disputed: true,
            seller: { select: { name: true, credential: true } },
            hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true } },
            callBookings: { orderBy: { startTime: "asc" }, select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true } },
          },
        })
      : null,
  ]);
  const tz = tzOrDefault(student?.timeZone);
  const first = gift.studentName.split(" ")[0];
  const setUp = !!student && (!!student.passwordHash || student._count.accounts > 0);
  const h = order ? hoursSummary(order as any) : null;
  const calls = order?.callBookings ?? [];

  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Your gift</span>
        <h1 className="page-title" style={{ textAlign: "left" }}>Your gift to {gift.studentName}</h1>
        <p className="lede">Keep this link private: anyone with it can see this page. It never shows {first}&apos;s messages.</p>
      </div>

      {gift.status === "PENDING" && (
        <div role="status" className="alert alert-blue">
          {searchParams.paid ? "Thanks! We're confirming your payment with Stripe. Refresh this page in a minute." : "This gift hasn't been paid yet."}
        </div>
      )}
      {gift.status === "CANCELLED" && <div className="alert">Checkout was closed before paying, so nothing was charged. <Link href="/gift" className="link">Start a new gift</Link>.</div>}
      {gift.status === "NEEDS_REVIEW" && <div className="alert alert-warning">Your payment went through, but our team needs to sort something out with this gift. We&apos;ll email you; you can also <Link href="/contact" className="link">contact us</Link>.</div>}
      {searchParams.stripe === "none" && <div className="alert">Stripe&apos;s receipt isn&apos;t available right now. Stripe also emailed it to you when you paid.</div>}

      <section className="card stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
          <b style={{ fontSize: 18 }}>{gift.kind === "CREDIT" || !gift.orderId ? `${money(gift.amountCents)} of MentorsMD credit` : giftLine(gift)}</b>
          <span className={`badge ${gift.status === "PAID" ? "badge-success" : gift.status === "NEEDS_REVIEW" ? "badge-warning" : ""}`}>{GIFT_STATUS_LABEL[gift.status] || gift.status}</span>
        </div>
        <span className="text-secondary">
          For {gift.studentName} ({gift.studentEmail}) · {money(gift.amountCents)}{gift.paidAt ? ` · paid ${fmtDay(gift.paidAt, tz)}` : ""}
        </span>
        {order && <span className="text-secondary">Mentor: {order.seller.name}{order.seller.credential ? ` (${order.seller.credential})` : ""}</span>}
        {gift.kind === "PACKAGE" && gift.status === "PAID" && !gift.orderId && (
          <span className="text-muted small">The package couldn&apos;t be booked when your payment cleared, so the full amount was added to {first}&apos;s account as MentorsMD credit, to use with any mentor.</span>
        )}
        {gift.note && <span className="text-muted small" style={{ whiteSpace: "pre-wrap" }}>Your note: {gift.note}</span>}
        {gift.paidAt && (
          <a href={`/api/gift/${params.token}/receipt`} className="link small" target="_blank" rel="noopener noreferrer">View Stripe&apos;s card receipt</a>
        )}
      </section>

      {gift.status === "PAID" && (
        <section className="card stack-sm">
          <h2 style={{ fontSize: 22 }}>{first}&apos;s account</h2>
          <p className="text-secondary">
            {setUp
              ? `${first} has a MentorsMD account and can use your gift${student?.minorStatus && student.minorStatus !== "CONSENTED" ? " once a parent or guardian gives consent" : ""}.`
              : `We've emailed ${first} a link to set up their account. If they can't find it, they can use Forgot password on the login page with ${gift.studentEmail}.`}
          </p>
        </section>
      )}

      {order && h && (
        <section className="stack-sm">
          <h2 style={{ fontSize: 26 }}>Hours and calls</h2>
          <div className="card stack-sm">
            <span className="badge badge-brand" style={{ alignSelf: "flex-start" }}>
              {order.disputed && ["IN_ESCROW", "COMPLETED"].includes(order.status) ? "Under review" : ORDER_STATUS[order.status] || order.status}
            </span>
            <span>
              <b>{shortHours(h.used)}</b> used of {shortHours(h.purchased)} · <b>{shortHours(h.left)}</b> left
              {h.reserved > 0 ? ` · ${shortHours(h.reserved)} booked for upcoming calls` : ""}
            </span>
            <span className="text-muted small">
              {h.callsHeld} call{h.callsHeld === 1 ? "" : "s"} held · {h.writtenCount} block{h.writtenCount === 1 ? "" : "s"} of written feedback
            </span>
          </div>
          <div className="card" style={{ padding: "4px 20px" }}>
            {calls.length === 0 && <p className="text-muted" style={{ padding: "12px 0" }}>No calls booked yet.</p>}
            {calls.map((c) => (
              <div key={c.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <b className="grow" style={{ fontSize: 15 }}>
                  {c.startTime.toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
                </b>
                <span className={`badge ${c.status === "CANCELLED" ? "" : c.endTime < new Date() ? "badge-success" : "badge-brand"}`}>
                  {c.status === "CANCELLED" ? "Cancelled" : c.endTime < new Date() ? (c.outcome && c.outcome !== "HELD" ? "Missed" : "Held") : "Upcoming"}
                </span>
              </div>
            ))}
          </div>
          <span className="text-muted small">Every call and block of written work is logged on the package. Any refund our team grants is given to {first} as MentorsMD credit.</span>
        </section>
      )}

      <span className="text-muted small">
        Want to give more? <Link href="/gift" className="link">Gift MentorsMD</Link>.
      </span>
    </div>
  );
}
