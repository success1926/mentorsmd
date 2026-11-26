import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { cancelAppPayment } from "@/lib/hourCheckout";

export const dynamic = "force-dynamic";

// The student closed the app's payment sheet without paying. { orderId }
// or { topUpId } -> { status: "cancelled" | "paid" | "pending" }. The
// payment is cancelled on Stripe, then the order or top-up, and any credit
// applied is given back. If it was paid after all, it's kept ("paid").
export async function POST(req: Request) {
  const me = await requireRole("BUYER");
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const target = { orderId: typeof body.orderId === "string" ? body.orderId : undefined, topUpId: typeof body.topUpId === "string" ? body.topUpId : undefined };
  const status = await cancelAppPayment(me.id, target);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status });
}
