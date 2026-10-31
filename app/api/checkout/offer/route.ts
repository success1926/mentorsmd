import { NextResponse } from "next/server";
import { CheckoutError, startOfferCheckout } from "@/lib/hourCheckout";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

// The Buy buttons on a mentor's profile (Hourly, bundles, specialized
// packages) post here with { gigId }. Checks (student, offer on sale,
// mentor listed, unlocked, under-18 rule), then MentorsMD credit first and
// Stripe Checkout for the rest (lib/hourCheckout.ts). Answers { url }: the
// Stripe page, or the new package page when credit covered everything.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can buy" }, { status: 403 });
  }
  const studentId = (session.user as any).id;
  const r = await rateLimit(RATE_LIMITS.messagesPerMinute, `checkout:${studentId}`);
  if (!r.ok) return tooMany(r.retryAfterSec, "Please wait a moment and try again.");
  const body = await req.json().catch(() => ({}));
  if (typeof body.gigId !== "string") return NextResponse.json({ error: "Package not found" }, { status: 404 });
  try {
    const { url } = await startOfferCheckout({ id: studentId, email: session.user.email }, body.gigId);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("Offer checkout failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
