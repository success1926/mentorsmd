import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consentByViewToken } from "@/lib/minors";
import { money } from "@/lib/options";
import { WithdrawButton } from "./WithdrawButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parent page · MentorsMD", robots: { index: false } };

const ORDER_STATUS: Record<string, string> = {
  IN_ESCROW: "In progress (payment held)",
  COMPLETED: "Delivered, waiting for approval",
  RELEASED: "Completed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};
const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// A parent or guardian's private page (#109): their student's orders and
// calls, and a button to withdraw consent. The link was emailed when they
// consented; it stops working when the student turns 18.
export default async function ParentPage({ params }: { params: { token: string } }) {
  const consent = await consentByViewToken(params.token);
  if (!consent) {
    return (
      <div className="page-narrow">
        <div className="card-narrow stack">
          <h1 className="page-title" style={{ fontSize: 34 }}>This link isn&apos;t active</h1>
          <p className="text-secondary">Parent links stop working when consent is withdrawn or when the student turns 18. Contact us if you need help.</p>
          <Link href="/contact" className="link">Contact us</Link>
        </div>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { buyerId: consent.userId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, status: true, amount: true, createdAt: true, dueDate: true, disputed: true,
      gig: { select: { title: true } },
      seller: { select: { name: true, credential: true } },
      callBookings: { orderBy: { startTime: "asc" }, select: { id: true, startTime: true, endTime: true, status: true } },
    },
  });
  const first = consent.user.name.split(" ")[0];
  const paid = orders.filter((o) => o.status !== "CANCELLED");
  const calls = orders.flatMap((o) => o.callBookings.map((c) => ({ ...c, gigTitle: o.gig.title, mentor: o.seller.name })));

  return (
    <div className="page-narrow stack-lg">
      <div className="stack-sm">
        <span className="eyebrow">Parent page</span>
        <h1 className="page-title" style={{ textAlign: "left" }}>{consent.user.name}&apos;s orders and calls</h1>
        <p className="lede">
          You gave consent on {consent.consentedAt ? fmtDay(consent.consentedAt) : "file"} (signed &ldquo;{consent.signatureName}&rdquo;). Keep this link private.
        </p>
      </div>

      <section className="stack-sm">
        <h2 style={{ fontSize: 26 }}>Orders</h2>
        <div className="card" style={{ padding: "4px 20px" }}>
          {paid.length === 0 && <p className="text-muted" style={{ padding: "12px 0" }}>{first} hasn&apos;t booked anything yet.</p>}
          {paid.map((o) => (
            <div key={o.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 200 }}>
                <b style={{ fontSize: 15 }}>{o.gig.title}</b>
                <span className="text-muted">
                  Mentor: {o.seller.name}{o.seller.credential ? ` (${o.seller.credential})` : ""} · booked {fmtDay(o.createdAt)}
                  {o.dueDate ? ` · due ${fmtDay(o.dueDate)}` : ""}
                </span>
              </div>
              <b>{money(o.amount)}</b>
              <span className={`badge ${o.status === "REFUNDED" ? "badge-pink" : o.status === "RELEASED" ? "badge-success" : "badge-brand"}`}>
                {o.disputed && ["IN_ESCROW", "COMPLETED"].includes(o.status) ? "Under review" : ORDER_STATUS[o.status] || o.status}
              </span>
            </div>
          ))}
        </div>
        <span className="text-muted small">Payment held until you approve: money is only released to a mentor after the work is delivered and approved (or the review window passes).</span>
      </section>

      <section className="stack-sm">
        <h2 style={{ fontSize: 26 }}>Calls</h2>
        <div className="card" style={{ padding: "4px 20px" }}>
          {calls.length === 0 && <p className="text-muted" style={{ padding: "12px 0" }}>No calls booked.</p>}
          {calls.map((c) => (
            <div key={c.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2 }}>
                <b style={{ fontSize: 15 }}>{c.startTime.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</b>
                <span className="text-muted">{c.gigTitle} with {c.mentor}</span>
              </div>
              <span className={`badge ${c.status === "CANCELLED" ? "" : c.endTime < new Date() ? "badge-success" : "badge-brand"}`}>
                {c.status === "CANCELLED" ? "Cancelled" : c.endTime < new Date() ? "Held" : "Upcoming"}
              </span>
            </div>
          ))}
        </div>
        <span className="text-muted small">Calls happen in a private MentorsMD video room and may be recorded for safety; only the MentorsMD team can watch a recording, and only if there&apos;s a problem.</span>
      </section>

      <section className="card stack-sm">
        <h2 style={{ fontSize: 22 }}>Withdraw consent</h2>
        <p className="text-secondary">
          If you withdraw consent, {first}&apos;s account is paused right away: they can&apos;t message mentors or book anything. Our team will contact you about any orders still in progress.
        </p>
        <WithdrawButton token={params.token} name={first} />
      </section>
    </div>
  );
}
