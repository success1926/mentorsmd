import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLATFORM_FEE_PERCENT } from "@/lib/stripe";

// Powers the dashboard shown to the site owner: how much has been
// collected in total, how much of that is your 20% cut, how much has
// already gone out to sellers, and what's still sitting in escrow.
// All figures are derived from Order rows, not tracked separately, so they
// can never drift from what Stripe actually did.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: { status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } },
    include: { gig: true, seller: true, buyer: true },
    orderBy: { createdAt: "desc" },
  });

  let totalCollected = 0;
  let platformCut = 0;
  let paidToSellers = 0;
  let inEscrow = 0;

  for (const order of orders) {
    totalCollected += order.amount;
    const fee = Math.round((order.amount * PLATFORM_FEE_PERCENT) / 100);
    if (order.status === "RELEASED") {
      platformCut += fee;
      paidToSellers += order.amount - fee;
    } else {
      inEscrow += order.amount;
    }
  }

  return NextResponse.json({
    totalCollectedCents: totalCollected,
    platformCutCents: platformCut,
    paidToSellersCents: paidToSellers,
    inEscrowCents: inEscrow,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      gigTitle: o.gig.title,
      buyerName: o.buyer.name,
      sellerName: o.seller.name,
      amountCents: o.amount,
      platformFeeCents: Math.round((o.amount * PLATFORM_FEE_PERCENT) / 100),
      sellerPayoutCents: o.amount - Math.round((o.amount * PLATFORM_FEE_PERCENT) / 100),
    })),
  });
}
