import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { confirmAppPayment } from "@/lib/hourCheckout";

export const dynamic = "force-dynamic";

// The app calls this when the payment sheet says it's paid, in case the
// Stripe webhook is slow. { orderId } or { topUpId } -> { status: "paid" |
// "pending" | "cancelled" }. Stripe is asked directly; the app's word is
// never taken for it.
export async function POST(req: Request) {
  const me = await requireRole("BUYER");
  if (me instanceof NextResponse) return me;
  const body = await req.json().catch(() => ({}));
  const target = { orderId: typeof body.orderId === "string" ? body.orderId : undefined, topUpId: typeof body.topUpId === "string" ? body.topUpId : undefined };
  const status = await confirmAppPayment(me.id, target).catch((err) => {
    console.error("Confirming an app payment failed", err);
    return "pending" as const;
  });
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status });
}
