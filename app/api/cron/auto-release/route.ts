import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseOrder, FundsNotYetAvailableError } from "@/lib/orderRelease";

const WINDOW_HOURS = 96;

// Runs once daily at 3am UTC (see vercel.json) - checks every COMPLETED
// order and releases any where 96 hours have passed since the seller
// marked it done, regardless of whether the buyer ever clicked anything.
// This is the mechanism that makes "funds release automatically after
// 96 hours" actually true, rather than just a promise in the UI.
//
// Why daily rather than hourly: Vercel's free Hobby tier only allows
// cron jobs to run once per day - an hourly schedule fails to deploy at
// all on that tier. Rather than requiring a paid Vercel plan or a
// third-party scheduler just for slightly tighter timing, this runs
// once a day, which adds at most ~24 hours of slack on top of the
// 96-hour window (a small fraction of it, not a meaningful delay in
// practice). If you later upgrade to Vercel Pro, you can change the
// schedule in vercel.json to "0 * * * *" for near-exact 96-hour timing
// - no other code changes needed.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const dueForRelease = await prisma.order.findMany({
    where: {
      status: "COMPLETED",
      workCompletedAt: { lte: cutoff },
      disputed: false, // never auto-release something an admin still needs to look at
    },
  });

  const results = [];
  for (const order of dueForRelease) {
    try {
      await releaseOrder(order.id);
      results.push({ orderId: order.id, released: true });
    } catch (err: any) {
      if (err instanceof FundsNotYetAvailableError) {
        // Not a real problem - just means this specific payment hasn't
        // settled with Stripe yet. Since the order stays COMPLETED,
        // tomorrow's run will pick it up again automatically.
        console.log(`Order ${order.id}: funds not available until ${err.availableAt.toISOString()}, will retry tomorrow.`);
        results.push({ orderId: order.id, released: false, reason: "funds_settling" });
      } else {
        console.error(`Auto-release failed for order ${order.id}:`, err);
        results.push({ orderId: order.id, released: false, error: err.message });
      }
    }
  }

  return NextResponse.json({ checked: dueForRelease.length, results });
}
