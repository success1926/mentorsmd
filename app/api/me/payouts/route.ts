import { NextResponse } from "next/server";
import { mentorPayoutSummary } from "@/lib/payouts";
import { getSession, sessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// The mentor's earnings: earned and not yet paid, held by disputes, the
// next payout day (the 24th) and past monthly payouts.
export async function GET() {
  const me = sessionUser(await getSession());
  if (!me || me.role !== "SELLER") return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  return NextResponse.json(await mentorPayoutSummary(me.id));
}
