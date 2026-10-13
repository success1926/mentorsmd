import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { runCallReminders } from "@/lib/callReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Call reminders (morning-of at 8am local, and 1 hour before). Runs every
// 15 minutes from vercel.json (Vercel Pro); Vercel sends CRON_SECRET.
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runCallReminders();
  return NextResponse.json(results);
}
