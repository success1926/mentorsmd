import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runDailySafety } from "@/lib/safetyChecks";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Daily (see vercel.json): performance flags, off-site patterns, the
// essay-with-no-draft check, missed high-severity alerts, cleanup of old
// rate-limit counters, and on Mondays the weekly safety digest email.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDailySafety(new Date());
  return NextResponse.json(result);
}
