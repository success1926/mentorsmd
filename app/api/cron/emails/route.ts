import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runScheduledEmails } from "@/lib/scheduledEmails";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Daily (see vercel.json): the reminder emails that depend on time passing
// (checkout not finished, no mentor contacted yet, after the intro call,
// finish your profile, connect payouts). Each one is switched on and
// timed in Admin -> Emails; see lib/scheduledEmails.ts.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await runScheduledEmails(new Date());
  return NextResponse.json({ ok: true, sent });
}
