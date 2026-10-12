import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runDailySafety } from "@/lib/safetyChecks";
import { runDailyMinorChecks } from "@/lib/minors";
import { cleanupOldActivity } from "@/lib/activity";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Daily (see vercel.json): performance flags, off-site patterns, the
// essay-with-no-draft check, missed high-severity alerts, cleanup of old
// rate-limit counters, and on Mondays the weekly safety digest email.
// Also (Phase 5) parent consent reminders, expired consent links and
// students turning 18. Phase 6: deletes activity log entries older
// than about 13 months.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runDailySafety(new Date());
  // Phase 5: parent consent reminders and expired links, 18th birthdays.
  let minors: unknown = null;
  try {
    minors = await runDailyMinorChecks(new Date());
  } catch (err) {
    console.error("Daily minor checks failed:", err);
    minors = { error: String(err) };
  }
  // Phase 6: the private activity log keeps about 13 months.
  const activityDeleted = await cleanupOldActivity(new Date()).catch((err) => {
    console.error("Activity log cleanup failed:", err);
    return null;
  });
  return NextResponse.json({ ...result, minors, activityDeleted });
}
