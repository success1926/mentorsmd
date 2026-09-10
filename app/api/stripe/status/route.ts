import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STRIPE_VERSION = "2026-08-26.preview";

// A user having a stripeAccountId saved doesn't mean onboarding was
// actually finished - the account is created BEFORE the redirect to
// Stripe's form, so someone could abandon partway through and still
// technically "have an account." This checks the real status with
// Stripe directly: any outstanding requirements means it's not done yet.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only seller accounts have payout status" }, { status: 403 });
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stripeAccountId) {
    return NextResponse.json({ connected: false, started: false });
  }

  try {
    // Requesting several possibly-relevant fields, using repeated
    // `include=` params rather than bracket syntax (include[]=...) -
    // the bracket format is more of a Rails/PHP convention and may not
    // be what Stripe's v2 API actually expects, which could explain why
    // requirements weren't showing up in the previous version of this
    // check.
    const url = `https://api.stripe.com/v2/core/accounts/${user.stripeAccountId}?include=requirements&include=configuration.recipient&include=identity`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Stripe-Version": STRIPE_VERSION,
      },
    });
    const account = await res.json();

    if (!res.ok) {
      return NextResponse.json({ connected: false, started: true, error: account.error?.message, rawAccount: account });
    }

    // v2's requirements format is different from the older v1 system:
    // not a flat array of strings, but `requirements.entries` - an array
    // of detail objects, each with its own status. We only care about
    // ones actively blocking right now (status "currently_due").
    const entries: any[] = account.requirements?.entries || [];
    const outstandingItems = entries
      .filter((entry) => entry.status === "currently_due")
      .map((entry) => entry.requirement || entry.field || entry.reason || JSON.stringify(entry));

    // rawAccount is returned unconditionally (not just when something
    // looks wrong) so the frontend can always show exactly what Stripe
    // sent, however this eventually gets resolved.
    return NextResponse.json({ connected: outstandingItems.length === 0, started: true, outstandingItems, rawAccount: account });
  } catch (err: any) {
    console.error("Failed to check Stripe account status:", err);
    return NextResponse.json({ connected: false, started: true, error: "Couldn't check status" });
  }
}
