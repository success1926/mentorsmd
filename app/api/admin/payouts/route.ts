import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { nextPayoutDay, payoutPeriod } from "@/lib/payoutRules";

export const dynamic = "force-dynamic";

// Admin -> Orders & payouts: the monthly payouts (newest first).
export async function GET() {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const payouts = await prisma.mentorPayout.findMany({
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true, period: true, amountCents: true, grossCents: true, minutes: true, entryCount: true, status: true, stripeTransferId: true, error: true, createdAt: true, paidAt: true,
      mentor: { select: { id: true, name: true, stripeAccountId: true } },
      _count: { select: { orders: true } },
    },
  });
  return NextResponse.json({
    payouts: payouts.map(({ mentor, _count, ...p }) => ({ ...p, mentor: { id: mentor.id, name: mentor.name, payoutsConnected: !!mentor.stripeAccountId }, packagesSettled: _count.orders })),
    currentPeriod: payoutPeriod(),
    nextPayoutDay: nextPayoutDay(),
    isOwner: admin.adminRole === "OWNER",
  });
}
