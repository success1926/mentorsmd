import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runCallReminders } from "@/lib/callReminders";
import { runCallOutcomes } from "@/lib/callOutcomeRunner";
import { runAutoApprovals } from "@/lib/orderFinish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Call reminders (morning-of at 8am local, and 1 hour before), then call
// outcomes (held / no-show / nobody joined, about 30 minutes after each
// call ends; lib/callOutcomeRunner.ts; held calls are added to the hours
// log), then auto-approval of hours packages whose 48 hours to respond
// have passed (lib/orderFinish.ts). Runs every 15 minutes from
// vercel.json (Vercel Pro); Vercel sends CRON_SECRET.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = await runCallReminders().catch((err) => {
    console.error("Call reminders failed", err);
    return { error: true };
  });
  const outcomes = await runCallOutcomes().catch((err) => {
    console.error("Call outcomes failed", err);
    return { error: true };
  });
  const approvals = await runAutoApprovals().catch((err) => {
    console.error("Auto-approvals failed", err);
    return { error: true };
  });
  return NextResponse.json({ reminders, outcomes, approvals });
}
