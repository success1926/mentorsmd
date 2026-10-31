import { NextResponse } from "next/server";
import { receiptFor, stripeReceiptUrl } from "@/lib/receipts";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Opens Stripe's own receipt for one of the student's payments. Looked up
// from Stripe when asked (the address isn't stored); only the student who
// paid can open it. If Stripe has none, back to our receipt page.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const user = session?.user as any;
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "BUYER") return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  const r = await receiptFor(user.id, params.id);
  if (!r) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  const url = await stripeReceiptUrl(r.stripeRef);
  if (url && /^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i.test(url)) return NextResponse.redirect(url);
  return NextResponse.redirect(new URL(`/receipts/${encodeURIComponent(r.id)}?stripe=none`, req.url));
}
