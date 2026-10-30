import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { PayoutError, retryPayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Retry a failed monthly payout (money: needs the Orders permission).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    return NextResponse.json(await retryPayout(params.id, admin.id));
  } catch (err) {
    if (err instanceof PayoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
