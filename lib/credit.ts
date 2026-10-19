// MentorsMD credit (redesign Oct 2026, docs/redesign-2026-10.md section 6).
// A ledger: the balance is the sum of a student's CreditEntry rows (cents,
// positive = credit added, negative = spent). Credit never expires and can
// be spent with any mentor. Server only.
//
// At checkout the credit is taken straight away (a SPENT entry), so the
// same credit can't be spent twice by two checkouts open at once; if the
// Stripe page then expires or is cancelled, it's given back (a
// SPENT_REVERSED entry). See lib/hourCheckout.ts.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function creditBalance(userId: string, tx: Tx | typeof prisma = prisma) {
  const sum = await tx.creditEntry.aggregate({ where: { userId }, _sum: { amountCents: true } });
  return Math.max(0, sum._sum.amountCents ?? 0);
}

// Holds the student's credit for the rest of the transaction, so two
// checkouts at the same moment can't both spend the same balance.
export async function lockCredit(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"credit:" + userId}))`;
}

export async function spendCredit(tx: Tx, e: { userId: string; amountCents: number; orderId?: string | null; topUpId?: string | null; note?: string }) {
  if (e.amountCents <= 0) return null;
  return tx.creditEntry.create({
    data: { userId: e.userId, amountCents: -e.amountCents, reason: "SPENT", orderId: e.orderId ?? null, topUpId: e.topUpId ?? null, note: e.note ?? null },
  });
}

// Gives back the credit spent on a checkout that was never paid. Safe to
// call more than once: only what's still spent (spent minus already given
// back) is returned.
export async function reverseCredit(target: { orderId?: string; topUpId?: string }, note: string) {
  const where = target.topUpId ? { topUpId: target.topUpId } : target.orderId ? { orderId: target.orderId, topUpId: null } : null;
  if (!where) return 0;
  return prisma.$transaction(async (tx) => {
    const first = await tx.creditEntry.findFirst({ where: { ...where, reason: "SPENT" }, select: { userId: true } });
    if (!first) return 0;
    await lockCredit(tx, first.userId);
    const rows = await tx.creditEntry.findMany({ where: { ...where, reason: { in: ["SPENT", "SPENT_REVERSED"] } }, select: { amountCents: true } });
    const outstanding = -rows.reduce((s, r) => s + r.amountCents, 0);
    if (outstanding <= 0) return 0;
    await tx.creditEntry.create({
      data: { userId: first.userId, amountCents: outstanding, reason: "SPENT_REVERSED", orderId: target.orderId ?? null, topUpId: target.topUpId ?? null, note },
    });
    return outstanding;
  });
}

export function creditEntries(userId: string, take = 50) {
  return prisma.creditEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take, select: { id: true, amountCents: true, reason: true, note: true, createdAt: true, orderId: true } });
}
