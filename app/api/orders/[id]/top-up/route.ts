import { NextResponse } from "next/server";
import { CheckoutError, startTopUpCheckout } from "@/lib/hourCheckout";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { getSession, sessionUser } from "@/lib/session";

// "Add hours" on a package: { hours: 1 | 2 | 3 | 5 } at the package's own
// per-hour rate. Credit first, then Stripe Checkout (lib/hourCheckout.ts).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = sessionUser(await getSession());
  if (!me || me.role !== "BUYER") {
    return NextResponse.json({ error: "Only the student on this package can add hours" }, { status: 403 });
  }
  const studentId = me.id;
  const r = await rateLimit(RATE_LIMITS.messagesPerMinute, `checkout:${studentId}`);
  if (!r.ok) return tooMany(r.retryAfterSec, "Please wait a moment and try again.");
  const body = await req.json().catch(() => ({}));
  try {
    const { url } = await startTopUpCheckout({ id: studentId, email: me.email }, params.id, Number(body.hours));
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("Top-up checkout failed", err);
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
