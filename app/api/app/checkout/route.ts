import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { CheckoutError, startOfferAppPayment, startPayPerCallAppPayment, startTopUpAppPayment } from "@/lib/hourCheckout";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// The phone app's checkout (Stripe's payment sheet, with Apple Pay and
// Google Pay). The same rules, prices and credit-first as the website's
// checkout (lib/hourCheckout.ts); only the last step differs.
//   { type: "offer", gigId }                          buy an offer from a profile
//   { type: "call", mentorId, start (ISO), minutes }  pay for a single call
//   { type: "hours", orderId, hours }                 add hours to a package
// Answers { paid: true, orderId, topUpId? } when credit covered it all, or
// { paid: false, orderId, topUpId?, clientSecret, paymentIntentId,
//   chargeCents, creditCents, publishableKey } for the payment sheet.
// After the sheet: /api/app/checkout/confirm (paid) or /cancel (closed).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can buy" }, { status: 403 });
  }
  const studentId = (session.user as any).id;
  const r = await rateLimit(RATE_LIMITS.messagesPerMinute, `checkout:${studentId}`);
  if (!r.ok) return tooMany(r.retryAfterSec, "Please wait a moment and try again.");
  const body = await req.json().catch(() => ({}));
  const student = { id: studentId, email: session.user.email };

  try {
    let result;
    if (body.type === "offer" && typeof body.gigId === "string") {
      result = await startOfferAppPayment(student, body.gigId);
    } else if (body.type === "call" && typeof body.mentorId === "string" && typeof body.start === "string") {
      const start = new Date(body.start);
      if (isNaN(start.getTime())) return NextResponse.json({ error: "Pick a time." }, { status: 400 });
      result = await startPayPerCallAppPayment(student, body.mentorId, start, body.minutes);
    } else if (body.type === "hours" && typeof body.orderId === "string") {
      result = await startTopUpAppPayment(student, body.orderId, body.hours);
    } else {
      return NextResponse.json({ error: "Update the app and try again." }, { status: 400 });
    }
    return NextResponse.json(result.paid ? result : { ...result, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("App checkout failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
