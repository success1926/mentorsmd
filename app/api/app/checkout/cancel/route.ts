import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { cancelAppPayment } from "@/lib/hourCheckout";

export const dynamic = "force-dynamic";

// The student closed the app's payment sheet without paying. { orderId }
// or { topUpId } -> { status: "cancelled" | "paid" | "pending" }. The
// payment is cancelled on Stripe, then the order or top-up, and any credit
// applied is given back. If it was paid after all, it's kept ("paid").
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "BUYER") return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const target = { orderId: typeof body.orderId === "string" ? body.orderId : undefined, topUpId: typeof body.topUpId === "string" ? body.topUpId : undefined };
  const status = await cancelAppPayment((session.user as any).id, target);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status });
}
