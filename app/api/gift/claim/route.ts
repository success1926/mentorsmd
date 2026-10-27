import { NextResponse } from "next/server";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";
import { requestMeta } from "@/lib/legal";
import { claimGift } from "@/lib/gifts";
import { UNDER_13_MESSAGE } from "@/lib/legalKinds";

// "Set up your account" from a gift email (lib/gifts.ts claimGift): the
// student's new account gets its password, date of birth and agreements.
// The browser then logs in with the new password.
export async function POST(req: Request) {
  const limit = await rateLimit(RATE_LIMITS.giftClaimPerIpHour, ipKey(req));
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const body = await req.json().catch(() => ({}));
  const r = await claimGift(body, requestMeta(req));
  if (r.ok === true) return NextResponse.json(r);
  if ("under13" in r) return NextResponse.json({ error: UNDER_13_MESSAGE, code: "UNDER_13" }, { status: 400 });
  return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
}
