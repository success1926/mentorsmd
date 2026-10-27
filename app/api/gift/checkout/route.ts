import { NextResponse } from "next/server";
import { isBot } from "@/lib/honeypot";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { clientIp, ipKey } from "@/lib/request";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptcha";
import { GiftError, cleanGiftForm, startGiftCheckout } from "@/lib/gifts";

// The /gift form: a parent (no account) buys MentorsMD credit or a
// mentor's package for their student, and is sent to Stripe Checkout.
// Protected like the other public forms: hidden trap field, per-IP and
// per-email limits, reCAPTCHA.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // A bot filled in the hidden field: no checkout.
  if (isBot(body)) return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 400 });

  const ip = ipKey(req);
  for (const limit of [RATE_LIMITS.giftPerIpHour, RATE_LIMITS.giftPerIpDay]) {
    const r = await rateLimit(limit, ip);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many gift checkouts from this connection. Please try again later.");
  }
  if (!(await verifyRecaptcha(body.recaptchaToken, "gift", clientIp(req)))) {
    return NextResponse.json({ error: RECAPTCHA_FAILED }, { status: 400 });
  }

  try {
    const form = cleanGiftForm(body);
    const perEmail = await rateLimit(RATE_LIMITS.giftPerEmailDay, form.parentEmail);
    if (!perEmail.ok) return tooMany(perEmail.retryAfterSec, "Too many gift checkouts for this email today. Please try again tomorrow.");
    const { url } = await startGiftCheckout(form, ip);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof GiftError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Gift checkout failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
