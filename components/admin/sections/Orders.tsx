"use client";

import { useCallback, useEffect, useState } from "react";
import { KIND_LABEL } from "@/lib/pricing";
import Link from "next/link";
import { PLATFORM_FEE_PERCENT } from "@/lib/fee";
import { money } from "@/lib/options";
import { shortHours } from "@/lib/hours";
import { PAYOUT_STATUS_LABEL, payoutDayLabel, periodLabel } from "@/lib/payoutRules";
import { csvBody } from "@/lib/csv";
import { GIFT_STATUS_LABEL } from "@/lib/giftOptions";

// Admin -> Orders & payouts: the money summary (sales, credit, collected,
// fee, paid to mentors, not yet paid out), the monthly payouts to mentors
// (with "Run payouts now" for the Owner and Retry for failed ones), and
// every paid package (from /api/admin/earnings and /api/admin/payouts),
// and gifts parents bought on /gift (/api/admin/gifts, lib/gifts.ts).

function statusOf(o: any): { label: string; cls: string } {
  if (!o.kind) {
    if (o.status === "RELEASED") return { label: "Paid to mentor", cls: "badge-success" };
    if (o.status === "REFUNDED") return { label: "Refunded", cls: "badge-pink" };
    return { label: "Old order, payment held", cls: "badge-warning" };
  }
  if (o.status === "REFUNDED") return { label: "Refunded as credit", cls: "badge-pink" };
  if (o.status === "RELEASED") return { label: "Paid to mentor", cls: "badge-success" };
  if (o.status === "COMPLETED") return { label: "Approved, waiting for payout", cls: "badge-blue" };
  if (o.disputeOpen) return { label: "Disputed (hours held)", cls: "badge-danger" };
  if (o.phase === "AWAITING_STUDENT") return { label: "Waiting on student (48 h)", cls: "badge-warning" };
  return { label: "Active", cls: "badge-brand" };
}

const PAYOUT_CLS: Record<string, string> = { PAID: "badge-success", FAILED: "badge-danger", PROCESSING: "badge-warning" };

function download(filename: string, header: string[], rows: unknown[][]) {
  const blob = new Blob(["﻿" + csvBody(header, rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const dollars = (cents: number) => (cents / 100).toFixed(2);
const hrs = (minutes: number) => (minutes / 60).toFixed(1);

export function Orders() {
  const [earnings, setEarnings] = useState<any>(null);
  const [payouts, setPayouts] = useState<any>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "WAITING" | "PAID" | "REFUNDED" | "GIFT">("ALL");
  const [gifts, setGifts] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [run, setRun] = useState<any>(null);

  const load = useCallback(() => {
    fetch("/api/admin/earnings").then((r) => r.json()).then(setEarnings).catch(() => setEarnings({ orders: [] }));
    fetch("/api/admin/payouts").then((r) => r.json()).then(setPayouts).catch(() => setPayouts({ payouts: [] }));
    fetch("/api/admin/gifts").then((r) => r.json()).then((d) => setGifts(d.gifts || [])).catch(() => setGifts([]));
  }, []);
  useEffect(load, [load]);

  async function runNow() {
    const label = periodLabel(payouts.currentPeriod);
    if (!confirm(`Run the ${label} payouts now? Every mentor with connected payouts who hasn't been paid for ${label} yet is paid what they've earned so far. Mentors already paid for ${label} are left alone.`)) return;
    setBusy("run");
    setMsg(null);
    const res = await fetch("/api/admin/payouts/run", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setMsg({ ok: false, text: d.error || "Couldn't run payouts" });
    else setRun(d);
    load();
  }

  async function retry(p: any) {
    if (!confirm(`Retry the ${periodLabel(p.period)} payout of ${money(p.amountCents)} to ${p.mentor.name}? Stripe is checked first, so it can't be sent twice.`)) return;
    setBusy(p.id);
    setMsg(null);
    const res = await fetch(`/api/admin/payouts/${p.id}/retry`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(res.ok ? { ok: true, text: d.alreadySent ? "Stripe already had this transfer, so it's marked as paid." : "Sent." } : { ok: false, text: d.error || "Retry failed" });
    load();
  }

  const orders: any[] = earnings?.orders || [];
  const list = orders.filter((o) => {
    if (filter === "ALL") return true;
    if (filter === "PAID") return o.status === "RELEASED";
    if (filter === "REFUNDED") return o.status === "REFUNDED";
    if (filter === "WAITING") return o.status === "COMPLETED";
    if (filter === "GIFT") return !!o.giftFrom;
    return o.status === "IN_ESCROW";
  });
  const plist: any[] = payouts?.payouts || [];
  const failed = plist.filter((p) => p.status === "FAILED");

  function exportOrders() {
    download(
      "packages.csv",
      ["Date", "Package", "Kind", "Student", "Mentor", "Price", "Added hours", "Paid with credit", "Refunded as credit", "Hours bought", "Hours used", "Hours left", "Status", "Payout", "Bought by parent"],
      list.map((o) => [
        new Date(o.createdAt).toISOString().slice(0, 10), o.title, o.kind ? KIND_LABEL[o.kind] || o.kind : "Old order", o.buyerName, o.sellerName,
        dollars(o.priceCents), dollars(o.topUpCents), dollars(o.creditCents), dollars(o.refundedCreditCents),
        hrs(o.minutesPurchased), hrs(o.minutesUsed), hrs(o.minutesLeft), statusOf(o).label, o.payout ? `${o.payout.period} ${o.payout.status}` : "", o.giftFrom || "",
      ])
    );
  }
  function exportPayouts() {
    download(
      "monthly-payouts.csv",
      ["Period", "Mentor", "Amount", "Students paid", "Fee", "Hours", "Log entries", "Status", "Stripe transfer", "Paid at", "Error"],
      plist.map((p) => [p.period, p.mentor.name, dollars(p.amountCents), dollars(p.grossCents), dollars(p.grossCents - p.amountCents), hrs(p.minutes), p.entryCount, p.status, p.stripeTransferId || "", p.paidAt || "", p.error || ""])
    );
  }

  return (
    <>
      {earnings?.salesCents !== undefined && (
        <div className="stat-cards">
          {[
            ["Sales (packages + added hours)", earnings.salesCents, "var(--tint-soft)"],
            ["Paid with credit", earnings.creditUsedCents, "var(--tint-soft)"],
            ["Collected by card", earnings.collectedCents, "var(--blue)"],
            [`Your ${PLATFORM_FEE_PERCENT}% fee (on payouts sent)`, earnings.platformCutCents, "var(--pink-soft)"],
            ["Paid to mentors", earnings.paidToSellersCents, "var(--blue)"],
            ["Not yet paid out", earnings.notPaidOutCents, "var(--tint-soft)"],
            ["Credit issued", earnings.creditIssuedCents, "var(--pink-soft)"],
            ["Credit students still have", earnings.creditOutstandingCents, "var(--tint-soft)"],
            ["Gift credit sold (parents)", earnings.giftCreditSoldCents, "var(--blue)"],
          ].map(([label, cents, bg]: any) => (
            <div key={label} className="stat-card" style={{ background: bg }}>
              <span className="text-secondary">{label}</span>
              <span className="stat-num">{money(cents || 0)}</span>
            </div>
          ))}
        </div>
      )}

      <section className="stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 30 }}>Monthly payouts</h2>
          <div className="row-wrap">
            {plist.length > 0 && <button className="btn btn-sm" onClick={exportPayouts}>Download CSV</button>}
            {payouts?.isOwner && <button className="btn btn-sm btn-deep" disabled={busy === "run"} onClick={runNow}>{busy === "run" ? "Running…" : "Run payouts now"}</button>}
          </div>
        </div>
        <span className="text-muted small">
          Mentors are paid once a month, on the 24th{payouts?.nextPayoutDay ? ` (next: ${payoutDayLabel(payouts.nextPayoutDay)})` : ""}: everything logged or held since their last payout, plus the unused hours of packages approved by then.
          Hours on a package with an open dispute wait until it&apos;s decided. Mentors who haven&apos;t connected payouts are skipped until they do.
          {payouts?.isOwner ? " Run payouts now pays the latest month to anyone not paid for it yet; it never pays anyone twice in a month." : ""}
        </span>
        {failed.length > 0 && <div className="alert alert-danger">{failed.length} payout{failed.length === 1 ? "" : "s"} failed. Read the error, fix the cause (often the mentor&apos;s Stripe account, or not enough available balance in MentorsMD&apos;s Stripe account), then press Retry.</div>}
        {msg && <div role="status" className={`alert ${msg.ok ? "alert-success" : "alert-danger"}`}>{msg.text}</div>}
        {run && (
          <div className="alert alert-blue stack-sm">
            <b>{periodLabel(run.period)} payouts: {run.paid.length} paid, {run.failed.length} failed, {run.skipped.length} skipped{run.alreadyDone ? `, ${run.alreadyDone} already paid this month` : ""}.</b>
            {run.paid.map((p: any) => <span key={p.payoutId} className="small">Paid {p.name}: {money(p.amountCents)}</span>)}
            {run.failed.map((p: any) => <span key={p.payoutId} className="small">Failed {p.name}: {p.error}</span>)}
            {run.skipped.map((p: any) => <span key={p.mentorId} className="small">Skipped {p.name}: {p.reason}</span>)}
          </div>
        )}
        <div className="card" style={{ padding: "4px 20px" }}>
          {!payouts && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
          {payouts && plist.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No payouts yet. The first one runs on the 24th.</p>}
          {plist.map((p) => (
            <div key={p.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 200 }}>
                <b style={{ fontSize: 15 }}>{periodLabel(p.period)} · {p.mentor.name}</b>
                <span className="text-muted small">
                  {shortHours(p.minutes)} · {p.entryCount} log entr{p.entryCount === 1 ? "y" : "ies"}{p.packagesSettled ? ` · ${p.packagesSettled} package${p.packagesSettled === 1 ? "" : "s"} settled` : ""} · students paid {money(p.grossCents)}, fee {money(p.grossCents - p.amountCents)}
                  {p.stripeTransferId ? ` · ${p.stripeTransferId}` : ""}
                </span>
                {p.error && <span className="small" style={{ color: "var(--danger)" }}>{p.error}</span>}
              </div>
              <b>{money(p.amountCents)}</b>
              <span className={`badge ${PAYOUT_CLS[p.status] || ""}`}>{PAYOUT_STATUS_LABEL[p.status] || p.status}</span>
              {(p.status === "FAILED" || p.status === "PROCESSING") && (
                <button className="btn btn-sm" disabled={busy === p.id} onClick={() => retry(p)}>Retry</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="stack-sm">
        <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 30 }}>Paid packages</h2>
          {list.length > 0 && <button className="btn btn-sm" onClick={exportOrders}>Download CSV</button>}
        </div>
        <div className="tabs" role="tablist">
          {([["ALL", "All"], ["ACTIVE", "Active"], ["WAITING", "Approved, waiting for payout"], ["PAID", "Paid to mentor"], ["REFUNDED", "Refunded"], ["GIFT", "Gift / parent purchase"]] as const).map(([k, label]) => (
            <button key={k} role="tab" className="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <div className="card" style={{ padding: "4px 20px" }}>
          {!earnings && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
          {earnings && list.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No packages here yet.</p>}
          {list.map((o) => {
            const st = statusOf(o);
            return (
              <div key={o.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div className="grow stack-sm" style={{ gap: 2, minWidth: 200 }}>
                  <b style={{ fontSize: 15 }}>
                    {o.title}
                    {o.giftFrom && <span className="badge badge-pink" style={{ marginLeft: 8 }} title={`Bought by ${o.giftFrom} (parent)`}>Gift / parent purchase</span>}
                  </b>
                  <span className="text-muted">
                    {o.kind ? `${KIND_LABEL[o.kind] || o.kind} · ` : ""}{o.buyerName} (student) with {o.sellerName} (mentor)
                  </span>
                  {o.kind && (
                    <span className="text-muted small">
                      {shortHours(o.minutesUsed)} used of {shortHours(o.minutesPurchased)} · {shortHours(o.minutesLeft)} left
                      {o.topUpCents > 0 ? ` · added hours ${money(o.topUpCents)}` : ""}
                      {o.creditCents > 0 ? ` · credit applied ${money(o.creditCents)}` : ""}
                      {o.refundedCreditCents > 0 ? ` · refunded as credit ${money(o.refundedCreditCents)}` : ""}
                      {o.payout ? ` · payout ${periodLabel(o.payout.period)} (${PAYOUT_STATUS_LABEL[o.payout.status] || o.payout.status})` : ""}
                    </span>
                  )}
                </div>
                <span className="text-muted small">{money(o.priceCents)}</span>
                <span className={`badge ${st.cls}`}>{st.label}</span>
                <Link href={`/orders/${o.id}`} className="btn btn-sm">Open</Link>
              </div>
            );
          })}
        </div>
        <span className="text-muted small">Disputes are settled from Disputes &amp; flags: packages are refunded as MentorsMD credit, never to the card. Mentors are paid monthly through Stripe Connect.</span>
      </section>

      <GiftsSection gifts={gifts} />
    </>
  );
}

// Gifts parents bought on /gift (lib/gifts.ts), paid or not. A paid
// package is also in the list above (tagged); gifted credit is in the
// student's credit history (Admin -> People), where it can be removed like
// any credit if the parent is refunded in Stripe.
function GiftsSection({ gifts }: { gifts: any[] | null }) {
  const needs = (gifts || []).filter((g) => g.status === "NEEDS_REVIEW");
  function exportGifts() {
    download(
      "gifts.csv",
      ["Date", "Kind", "What", "Amount", "Parent", "Parent email", "Student", "Student email", "Under 18 (parent's answer)", "Status", "Student account ready", "Note for the team"],
      (gifts || []).map((g) => [
        new Date(g.paidAt || g.createdAt).toISOString().slice(0, 10), g.kind === "CREDIT" ? "Credit" : "Package", g.kind === "CREDIT" ? "MentorsMD credit" : `${g.packageTitle || ""}${g.mentorName ? ` with ${g.mentorName}` : ""}`,
        dollars(g.amountCents), g.parentName, g.parentEmail, g.studentName, g.studentEmail, g.studentUnder18 ? "Yes" : "No", GIFT_STATUS_LABEL[g.status] || g.status, g.accountReady ? "Yes" : "No", g.reviewNote || "",
      ])
    );
  }
  return (
    <section className="stack-sm">
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 30 }}>Gifts and parent purchases</h2>
        {gifts && gifts.length > 0 && <button className="btn btn-sm" onClick={exportGifts}>Download CSV</button>}
      </div>
      <span className="text-muted small">
        Parents pay as guests on the Gift page: MentorsMD credit, or one of a mentor&apos;s packages for their student. Refunds work like any other order or credit: a package from Disputes &amp; flags, credit from the student in People.
        A card refund to the parent is done in Stripe.
      </span>
      {needs.length > 0 && <div className="alert alert-danger">{needs.length} paid gift{needs.length === 1 ? "" : "s"} need{needs.length === 1 ? "s" : ""} the team: read the note on each one.</div>}
      <div className="card" style={{ padding: "4px 20px" }}>
        {!gifts && <p className="text-muted" style={{ padding: 12 }}>Loading…</p>}
        {gifts && gifts.length === 0 && <p className="text-muted" style={{ padding: 12 }}>No gifts yet.</p>}
        {(gifts || []).map((g) => (
          <div key={g.id} className="list-row" style={{ flexWrap: "wrap" }}>
            <div className="grow stack-sm" style={{ gap: 2, minWidth: 220 }}>
              <b style={{ fontSize: 15 }}>
                {g.kind === "CREDIT" ? "MentorsMD credit" : g.packageTitle}
                {g.mentorName ? ` · ${g.mentorName}` : ""}
              </b>
              <span className="text-muted small">
                From {g.parentName} ({g.parentEmail}) to {g.studentName} ({g.studentEmail}){g.studentUnder18 ? " · under 18" : ""} · {new Date(g.paidAt || g.createdAt).toLocaleDateString()}
                {g.status === "PAID" ? (g.accountReady ? " · student can log in" : " · student hasn't set up their account yet") : ""}
              </span>
              {g.reviewNote && <span className="small" style={{ color: g.status === "NEEDS_REVIEW" ? "var(--danger)" : undefined }}>{g.reviewNote}</span>}
            </div>
            <span className="text-muted small">{money(g.amountCents)}</span>
            <span className={`badge ${g.status === "PAID" ? "badge-success" : g.status === "NEEDS_REVIEW" ? "badge-danger" : ""}`}>{GIFT_STATUS_LABEL[g.status] || g.status}</span>
            {g.orderId && <Link href={`/orders/${g.orderId}`} className="btn btn-sm">Open</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}
