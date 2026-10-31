import { NextResponse } from "next/server";
import { mentorPayoutSummary } from "@/lib/payouts";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The mentor's earnings: earned and not yet paid, held by disputes, the
// next payout day (the 24th) and past monthly payouts.
export async function GET() {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "SELLER") return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  return NextResponse.json(await mentorPayoutSummary((session.user as any).id));
}
