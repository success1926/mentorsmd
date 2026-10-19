import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payoutAccountStatus } from "@/lib/stripeAccountStatus";

// A user having a stripeAccountId saved doesn't mean onboarding was
// actually finished - the account is created BEFORE the redirect to
// Stripe's form, so someone could abandon partway through and still
// technically "have an account." This checks the real status with Stripe
// (lib/stripeAccountStatus.ts): connected only when the account can
// receive transfers. Checkout and payouts use the same check.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentor accounts have payouts" }, { status: 403 });
  }

  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.stripeAccountId) {
    return NextResponse.json({ connected: false, started: false });
  }

  try {
    const status = await payoutAccountStatus(user.stripeAccountId);
    if (status.error) return NextResponse.json({ connected: false, started: true, error: status.error });
    // Not ready but nothing listed: Stripe is still reviewing.
    const outstandingItems = status.ready || status.outstandingItems.length ? status.outstandingItems : ["Stripe is still checking your details. Try Refresh status in a few minutes."];
    return NextResponse.json({ connected: status.ready, started: true, outstandingItems });
  } catch (err: any) {
    console.error("Failed to check Stripe account status:", err);
    return NextResponse.json({ connected: false, started: true, error: "Couldn't check status" });
  }
}
