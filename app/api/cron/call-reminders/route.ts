import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runCallReminders } from "@/lib/callReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Call reminders (morning-of at 8am local, and 1 hour before). Needs to
// run every 15 minutes, which Vercel's free Hobby plan doesn't allow, so
// it is NOT in vercel.json. Either:
//   - upgrade to Vercel Pro and add { "path": "/api/cron/call-reminders", "schedule": "*/15 * * * *" }
//     to vercel.json, or
//   - use a free scheduler such as cron-job.org: call
//     https://<your site>/api/cron/call-reminders every 15 minutes with the
//     header  Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runCallReminders();
  return NextResponse.json(results);
}
