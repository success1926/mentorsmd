import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { creditBalance, creditEntries } from "@/lib/credit";
import { CreditError, adjustCredit } from "@/lib/creditAdmin";

export const dynamic = "force-dynamic";

// Admin -> People -> a student: MentorsMD credit balance and history
// (People permission), and manual adjustments (Orders permission; every
// change needs a reason and goes in the action log).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin(["people", "orders"]);
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const [balanceCents, entries] = await Promise.all([creditBalance(params.id), creditEntries(params.id, 100)]);
  return NextResponse.json({ balanceCents, entries });
}

// Body: { amountCents (positive adds, negative removes), reason }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Changing credit needs the Orders permission" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await adjustCredit(params.id, admin, body?.amountCents, typeof body?.reason === "string" ? body.reason.slice(0, 500) : "");
    return NextResponse.json({ ...r, entries: await creditEntries(params.id, 100) });
  } catch (err) {
    if (err instanceof CreditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
