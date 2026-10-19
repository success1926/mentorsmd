import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { cleanupRecordings } from "@/lib/recordings";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Daily at 3am UTC (see vercel.json): deletes call recordings 60 days
// after their package closed. (Until the hourly redesign of Oct 2026 this
// job also released old-style orders 96 hours after delivery; packages are
// now approved by the student or after 48 hours (lib/orderFinish.ts) and
// paid with the monthly payout (lib/payouts.ts).)
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ recordings: await cleanupRecordings() });
  } catch (err: any) {
    console.error("Recording cleanup failed:", err);
    return NextResponse.json({ recordings: { error: err.message } });
  }
}
