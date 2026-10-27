import { NextResponse } from "next/server";
import { giftByViewToken } from "@/lib/gifts";
import { stripeReceiptUrl } from "@/lib/receipts";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

export const dynamic = "force-dynamic";

// Opens Stripe's own card receipt for a parent's gift (from their private
// gift page). Looked up from Stripe when asked; if Stripe has none, back
// to the gift page.
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const limit = await rateLimit(RATE_LIMITS.parentPagePerIpHour, ipKey(req));
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const gift = await giftByViewToken(params.token);
  if (!gift) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = gift.paidAt ? await stripeReceiptUrl(gift.stripeSessionId) : null;
  if (url && /^https:\/\/([a-z0-9-]+\.)*stripe\.com\//i.test(url)) return NextResponse.redirect(url);
  return NextResponse.redirect(new URL(`/gift/${params.token}?stripe=none`, req.url));
}
