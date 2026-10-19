import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { runMonthlyPayouts } from "@/lib/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// "Run payouts now" (Owner only): the same run as the cron on the 24th
// (lib/payouts.ts). Pays the latest payout period to every mentor who
// hasn't been paid for it yet; mentors already paid are left alone.
export async function POST() {
  const admin = await currentAdmin("orders");
  if (!admin || admin.adminRole !== "OWNER") return NextResponse.json({ error: "Only the Owner can run payouts" }, { status: 403 });
  const result = await runMonthlyPayouts({ adminId: admin.id });
  return NextResponse.json(result);
}
