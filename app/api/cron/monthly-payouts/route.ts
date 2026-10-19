import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runMonthlyPayouts } from "@/lib/payouts";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The monthly payout to mentors (lib/payouts.ts). Scheduled in vercel.json
// for 14:00 UTC on the 24th (10am in New York, 9am in winter). Safe to run
// again: each mentor is paid at most once per month, so a second run only
// picks up mentors who were skipped (e.g. payouts not connected yet).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runMonthlyPayouts({ adminId: null });
  return NextResponse.json(result);
}
