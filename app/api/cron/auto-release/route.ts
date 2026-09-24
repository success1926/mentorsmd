import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseOrder, FundsNotYetAvailableError, OrderStateChangedError } from "@/lib/orderRelease";
import { isAuthorizedCron } from "@/lib/cron";

const WINDOW_HOURS = 96;

// Vercel functions time out (10s by default). Each release is a Stripe
// call, so cap how many we do per run and stop early if we're running low
// on time - anything left over is picked up by the next run.
export const maxDuration = 60;
const BATCH_SIZE = 50;
const TIME_BUDGET_MS = 45_000;

// Runs once daily at 3am UTC (see vercel.json) - checks every COMPLETED
// order and releases any where 96 hours have passed since the seller
// marked it done, regardless of whether the buyer ever clicked anything.
// On Vercel Pro you can change the schedule in vercel.json to "0 * * * *"
// for near-exact 96-hour timing - no other code changes needed.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  const eligible = {
    status: "COMPLETED" as const,
    workCompletedAt: { lte: cutoff },
    disputed: false, // never auto-release something an admin still needs to look at
  };

  const dueForRelease = await prisma.order.findMany({
    // Skip orders that would just fail again (seller hasn't connected
    // payouts, funds still settling) so they can't clog the front of
    // every batch and starve everything behind them.
    where: {
      ...eligible,
      seller: { stripeAccountId: { not: null } },
      OR: [{ fundsAvailableAt: null }, { fundsAvailableAt: { lte: new Date() } }],
    },
    select: { id: true },
    orderBy: { workCompletedAt: "asc" },
    take: BATCH_SIZE,
  });

  const results = [];
  for (const order of dueForRelease) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      // The same conditions are re-checked atomically at claim time, so a
      // dispute or revision request that lands mid-run is respected.
      await releaseOrder(order.id, eligible);
      results.push({ orderId: order.id, released: true });
    } catch (err: any) {
      if (err instanceof FundsNotYetAvailableError) {
        results.push({ orderId: order.id, released: false, reason: "funds_settling" });
      } else if (err instanceof OrderStateChangedError) {
        results.push({ orderId: order.id, released: false, reason: "state_changed" });
      } else {
        console.error(`Auto-release failed for order ${order.id}:`, err);
        results.push({ orderId: order.id, released: false, error: err.message });
      }
    }
  }

  return NextResponse.json({ checked: dueForRelease.length, results });
}
