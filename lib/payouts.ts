// Monthly payouts to mentors (redesign Oct 2026, docs/redesign-2026-10.md
// section 7). The rules (what's included, the refund-as-credit deduction,
// the dates) are in lib/payoutRules.ts; this file reads the database,
// claims the hours and sends one Stripe transfer per mentor per month.
// Server only.
//
// Run by /api/cron/monthly-payouts on the 24th, and by the owner's "Run
// payouts now" button in Admin -> Orders & payouts (the same function).
// For each mentor:
//   1. Skip (and list) mentors without connected Stripe payouts; they're
//      paid in a later run once connected.
//   2. Skip mentors who already have a payout for this period (one per
//      mentor per month, enforced by a unique index too).
//   3. In one database transaction: work out the lines, create the
//      MentorPayout (PROCESSING) and claim what it pays (HourEntry.payoutId,
//      and Order.payoutId + unusedMinutesPaid for approved packages). If
//      anything changed meanwhile (a dispute opened, another run), the
//      transaction is undone and nothing is paid.
//   4. stripe.transfers.create with the idempotency key
//      payout-<mentor>-<period> and transfer_group = the payout id.
//   5. Success: PAID + transfer id; approved packages it settled move to
//      RELEASED; the mentor gets the "Monthly payout sent" email.
//      Failure: FAILED with the error; the claims stay (so the same hours
//      can't be paid twice), the error goes to Sentry as
//      "[NEEDS MANUAL CHECK]", and Admin -> Orders & payouts shows it with a
//      Retry button (retryPayout below), which first asks Stripe whether a
//      transfer for this payout already exists.
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { reportError } from "@/lib/sentry";
import { isDefiniteStripeFailure } from "@/lib/orderRelease";
import { sendPayoutSentEmail } from "@/lib/email";
import { money } from "@/lib/options";
import { hoursLabel } from "@/lib/pricing";
import { logAdminAction } from "@/lib/adminLog";
import {
  PayoutOrderLike,
  STUCK_PROCESSING_MS,
  mentorPayoutPreview,
  nextPayoutDay,
  payoutPeriod,
  periodLabel,
} from "@/lib/payoutRules";

type Db = Pick<typeof prisma, "order">;

class PayoutRaceError extends Error {
  constructor() {
    super("Something changed while the payout was being prepared");
  }
}

const orderSelect = {
  id: true,
  status: true,
  kind: true,
  rateCents: true,
  minutesPurchased: true,
  approvedAt: true,
  disputed: true,
  disputeResolvedAt: true,
  unusedMinutesPaid: true,
  hourEntries: { select: { id: true, minutes: true, voidedAt: true, payoutId: true, createdAt: true } },
  creditEntries: { where: { reason: "DISPUTE_REFUND" }, select: { amountCents: true } },
} as const;

// A mentor's packages that can still have something to pay.
export async function payableOrders(mentorId: string, db: Db = prisma): Promise<PayoutOrderLike[]> {
  const rows = await db.order.findMany({
    where: { sellerId: mentorId, kind: { not: null }, status: { in: ["IN_ESCROW", "COMPLETED"] } },
    select: orderSelect,
  });
  return rows.map(({ creditEntries, ...o }) => ({ ...o, refundedCreditCents: creditEntries.reduce((s, c) => s + c.amountCents, 0) }));
}

// Mentors with anything unpaid: an unpaid hours-log entry, or an approved
// package whose unused hours haven't been paid.
async function mentorsWithUnpaid() {
  const rows = await prisma.order.findMany({
    where: {
      kind: { not: null },
      status: { in: ["IN_ESCROW", "COMPLETED"] },
      OR: [{ hourEntries: { some: { payoutId: null, voidedAt: null } } }, { status: "COMPLETED", unusedMinutesPaid: null }],
    },
    distinct: ["sellerId"],
    select: { sellerId: true },
  });
  return rows.map((r) => r.sellerId);
}

export type PayoutRunResult = {
  period: string;
  paid: { mentorId: string; name: string; amountCents: number; payoutId: string }[];
  failed: { mentorId: string; name: string; amountCents: number; payoutId: string; error: string }[];
  skipped: { mentorId: string; name: string; reason: string }[];
  alreadyDone: number;
  closedWithoutTransfer: number;
};

export async function runMonthlyPayouts(opts: { now?: Date; adminId: string | null }): Promise<PayoutRunResult> {
  const now = opts.now ?? new Date();
  const period = payoutPeriod(now);
  const result: PayoutRunResult = { period, paid: [], failed: [], skipped: [], alreadyDone: 0, closedWithoutTransfer: 0 };
  const ids = await mentorsWithUnpaid();
  const mentors = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true, stripeAccountId: true } });
  for (const m of mentors) {
    try {
      const r = await payMentor(m, period, now);
      if (r.kind === "paid") result.paid.push({ mentorId: m.id, name: m.name, amountCents: r.amountCents, payoutId: r.payoutId });
      else if (r.kind === "failed") result.failed.push({ mentorId: m.id, name: m.name, amountCents: r.amountCents, payoutId: r.payoutId, error: r.error });
      else if (r.kind === "skipped") result.skipped.push({ mentorId: m.id, name: m.name, reason: r.reason });
      else if (r.kind === "exists") result.alreadyDone++;
      else if (r.kind === "closed") result.closedWithoutTransfer += r.count;
    } catch (err: any) {
      console.error("Payout failed", m.id, err);
      result.skipped.push({ mentorId: m.id, name: m.name, reason: err?.message || "Unexpected error" });
    }
  }
  if (opts.adminId) {
    await logAdminAction({
      adminId: opts.adminId,
      action: "PAYOUTS_RUN",
      summary: `Ran the ${periodLabel(period)} payouts: ${result.paid.length} paid, ${result.failed.length} failed, ${result.skipped.length} skipped`,
      details: { period, paid: result.paid.length, failed: result.failed.length, skipped: result.skipped },
    });
  }
  return result;
}

type MentorForPayout = { id: string; name: string; email: string; stripeAccountId: string | null };
type PayResult =
  | { kind: "paid"; payoutId: string; amountCents: number }
  | { kind: "failed"; payoutId: string; amountCents: number; error: string }
  | { kind: "skipped"; reason: string }
  | { kind: "exists" }
  | { kind: "closed"; count: number }
  | { kind: "nothing" };

async function payMentor(m: MentorForPayout, period: string, now: Date): Promise<PayResult> {
  if (await prisma.mentorPayout.findUnique({ where: { mentorId_period: { mentorId: m.id, period } }, select: { id: true } })) return { kind: "exists" };
  if (!m.stripeAccountId) return { kind: "skipped", reason: "Payouts not connected" };

  let claimed: { payoutId: string; amountCents: number; minutes: number; heldCents: number } | { closed: number } | null;
  try {
    claimed = await prisma.$transaction(
      async (tx) => {
        // One payout run per mentor at a time (the cron and the button).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"payout:" + m.id}))`;
        if (await tx.mentorPayout.findUnique({ where: { mentorId_period: { mentorId: m.id, period } }, select: { id: true } })) return null;
        const preview = mentorPayoutPreview(await payableOrders(m.id, tx), now);
        if (!preview.lines.length) return null;
        const finals = preview.lines.filter((l) => l.final);
        if (preview.amountCents <= 0) {
          // Only packages with nothing left to pay (e.g. refunded as credit
          // in full): settle them without a transfer.
          for (const l of finals) {
            await tx.order.updateMany({ where: { id: l.orderId, status: "COMPLETED", unusedMinutesPaid: null }, data: { status: "RELEASED", unusedMinutesPaid: l.unusedMinutes } });
          }
          return { closed: finals.length };
        }
        const payout = await tx.mentorPayout.create({
          data: {
            mentorId: m.id,
            period,
            cutoffAt: now,
            amountCents: preview.amountCents,
            grossCents: preview.grossCents,
            minutes: preview.minutes,
            entryCount: preview.entryCount,
            status: "PROCESSING",
          },
        });
        const entryIds = preview.lines.flatMap((l) => l.entryIds);
        if (entryIds.length) {
          const r = await tx.hourEntry.updateMany({
            where: {
              id: { in: entryIds },
              payoutId: null,
              voidedAt: null,
              // Never hours on a package whose dispute opened meanwhile.
              order: { status: { in: ["IN_ESCROW", "COMPLETED"] }, OR: [{ disputed: false }, { disputeResolvedAt: { not: null } }] },
            },
            data: { payoutId: payout.id },
          });
          if (r.count !== entryIds.length) throw new PayoutRaceError();
        }
        for (const l of finals) {
          const r = await tx.order.updateMany({
            where: { id: l.orderId, status: "COMPLETED", unusedMinutesPaid: null, payoutId: null },
            data: { unusedMinutesPaid: l.unusedMinutes, payoutId: payout.id },
          });
          if (!r.count) throw new PayoutRaceError();
        }
        return { payoutId: payout.id, amountCents: preview.amountCents, minutes: preview.minutes, heldCents: preview.heldCents };
      },
      { timeout: 20_000, maxWait: 10_000 }
    );
  } catch (err: any) {
    // Another run created this period's payout first.
    if (err?.code === "P2002") return { kind: "exists" };
    if (err instanceof PayoutRaceError) return { kind: "skipped", reason: "Hours changed during the run; run payouts again" };
    throw err;
  }
  if (!claimed) return { kind: "nothing" };
  if ("closed" in claimed) return { kind: "closed", count: claimed.closed };

  const sent = await sendTransfer(
    { id: claimed.payoutId, mentorId: m.id, period, amountCents: claimed.amountCents, stripeAccountId: m.stripeAccountId },
    `payout-${m.id}-${period}`
  );
  if (!("error" in sent)) {
    await payoutSentEmail(m, period, claimed.amountCents, claimed.minutes, claimed.heldCents);
    return { kind: "paid", payoutId: claimed.payoutId, amountCents: claimed.amountCents };
  }
  return { kind: "failed", payoutId: claimed.payoutId, amountCents: claimed.amountCents, error: sent.error };
}

type TransferTarget = { id: string; mentorId: string; period: string; amountCents: number; stripeAccountId: string };

async function sendTransfer(p: TransferTarget, idempotencyKey: string): Promise<{ ok: true; transferId: string } | { ok: false; error: string }> {
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: p.amountCents,
        currency: "usd",
        destination: p.stripeAccountId,
        transfer_group: p.id,
        description: `MentorsMD payout, ${periodLabel(p.period)}`,
        metadata: { payoutId: p.id, mentorId: p.mentorId, period: p.period },
      },
      { idempotencyKey }
    );
    await markPaid(p.id, transfer.id);
    return { ok: true, transferId: transfer.id };
  } catch (err: any) {
    const definite = isDefiniteStripeFailure(err);
    const note = definite
      ? `[NEEDS MANUAL CHECK] Monthly payout ${p.id} (${p.period}) to mentor ${p.mentorId} was refused by Stripe: ${err?.message || err}. Nothing was sent; fix the cause and press Retry in Admin -> Orders & payouts.`
      : `[NEEDS MANUAL CHECK] Monthly payout ${p.id} (${p.period}) to mentor ${p.mentorId} hit an unclear Stripe error. The transfer MAY have gone through: check Stripe for transfer_group=${p.id} before retrying (Retry checks this first).`;
    console.error(note, err);
    await prisma.mentorPayout.update({ where: { id: p.id }, data: { status: "FAILED", error: String(err?.message || err).slice(0, 500) } }).catch((e) => console.error("Couldn't mark payout failed", e));
    await reportError(note, err, { payoutId: p.id, mentorId: p.mentorId, period: p.period }, "fatal");
    return { ok: false, error: String(err?.message || "Stripe error") };
  }
}

async function markPaid(payoutId: string, transferId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.mentorPayout.update({ where: { id: payoutId }, data: { status: "PAID", stripeTransferId: transferId, paidAt: now, error: null } }),
    // Approved packages this payout settled: fully paid now.
    prisma.order.updateMany({ where: { payoutId, status: "COMPLETED" }, data: { status: "RELEASED", stripeTransferId: transferId } }),
  ]);
}

async function payoutSentEmail(m: { name: string; email: string }, period: string, amountCents: number, minutes: number, heldCents: number) {
  await sendPayoutSentEmail(m.email, {
    name: m.name,
    period: periodLabel(period),
    amount: money(amountCents),
    hours: hoursLabel(minutes),
    heldNote: heldCents > 0 ? `${money(heldCents)} on a package with an open dispute, paid once it's decided.` : "",
  }).catch((err) => console.error("Payout email failed", err));
}

export class PayoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Admin "Retry" on a FAILED payout (or one stuck in PROCESSING): the same
// amount and the same claimed hours. Asks Stripe first whether a transfer
// for this payout already exists (an unclear error can hide a transfer
// that went through), so a retry can never pay twice.
export async function retryPayout(payoutId: string, adminId: string) {
  const p = await prisma.mentorPayout.findUnique({ where: { id: payoutId }, include: { mentor: { select: { id: true, name: true, email: true, stripeAccountId: true } } } });
  if (!p) throw new PayoutError("Payout not found", 404);
  const stuck = p.status === "PROCESSING" && Date.now() - p.createdAt.getTime() > STUCK_PROCESSING_MS;
  if (p.status !== "FAILED" && !stuck) throw new PayoutError(p.status === "PAID" ? "This payout was already paid." : "This payout is still being sent. Try again in a few minutes.");
  if (!p.mentor.stripeAccountId) throw new PayoutError("This mentor hasn't connected payouts.");
  const claim = await prisma.mentorPayout.updateMany({ where: { id: p.id, status: p.status }, data: { status: "PROCESSING", error: null } });
  if (!claim.count) throw new PayoutError("This payout just changed. Refresh the page.", 409);

  let existing: { id: string } | undefined;
  try {
    const list = await stripe.transfers.list({ transfer_group: p.id, limit: 10 });
    existing = list.data.find((t) => !t.reversed && t.amount === p.amountCents && t.destination === p.mentor.stripeAccountId);
  } catch (err: any) {
    await prisma.mentorPayout.update({ where: { id: p.id }, data: { status: p.status, error: p.error } });
    throw new PayoutError(`Couldn't check Stripe for an earlier transfer: ${err?.message || err}`, 502);
  }
  await logAdminAction({
    adminId,
    action: "PAYOUT_RETRY",
    summary: `Retried the ${periodLabel(p.period)} payout of ${money(p.amountCents)} to ${p.mentor.name}`,
    targetUserId: p.mentorId,
    details: { payoutId: p.id, foundExistingTransfer: !!existing },
  });
  if (existing) {
    await markPaid(p.id, existing.id);
    return { status: "PAID", transferId: existing.id, alreadySent: true };
  }
  const sent = await sendTransfer(
    { id: p.id, mentorId: p.mentorId, period: p.period, amountCents: p.amountCents, stripeAccountId: p.mentor.stripeAccountId },
    `payout-${p.mentorId}-${p.period}-retry-${Date.now()}`
  );
  if ("error" in sent) throw new PayoutError(`Stripe refused the transfer again: ${sent.error}`, 502);
  await payoutSentEmail(p.mentor, p.period, p.amountCents, p.minutes, 0);
  return { status: "PAID", transferId: sent.transferId, alreadySent: false };
}

// The mentor's dashboard: earned and not yet paid (what the next payout
// would pay if it ran now), held back by disputes, the next payout day and
// past payouts.
export async function mentorPayoutSummary(mentorId: string, now: Date = new Date()) {
  const [orders, past, user] = await Promise.all([
    payableOrders(mentorId),
    prisma.mentorPayout.findMany({
      where: { mentorId },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { id: true, period: true, amountCents: true, minutes: true, status: true, paidAt: true, createdAt: true },
    }),
    prisma.user.findUnique({ where: { id: mentorId }, select: { stripeAccountId: true } }),
  ]);
  const preview = mentorPayoutPreview(orders, now);
  return {
    unpaidCents: preview.amountCents,
    unpaidMinutes: preview.minutes,
    heldCents: preview.heldCents,
    nextPayoutDay: nextPayoutDay(now),
    payoutsConnected: !!user?.stripeAccountId,
    past,
  };
}
