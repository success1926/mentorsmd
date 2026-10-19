import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { CreditError, refundAsCredit } from "@/lib/creditAdmin";

// Admin -> Disputes: "Refund as credit" on an hours package (full or
// partial). Money: needs the Orders permission. Body: { amountCents, note }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : "";
  try {
    return NextResponse.json(await refundAsCredit(params.id, admin, body?.amountCents, note));
  } catch (err) {
    if (err instanceof CreditError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
