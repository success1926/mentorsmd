import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { releaseOrder, FundsNotYetAvailableError } from "@/lib/orderRelease";

// Two ways a human reaches this:
//   1. Buyer confirms early, once the seller has marked work COMPLETED.
//   2. An admin overrides in either direction while resolving a dispute
//      (admins can release straight from IN_ESCROW too, not just
//      COMPLETED - a dispute is exactly the case where the normal
//      seller-marks-complete flow didn't happen cleanly).
// A third way - the 96-hour auto-release cron - does NOT come through
// this route, since there's no logged-in user in that context. It calls
// releaseOrder() directly instead (see /api/cron/auto-release).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const isBuyer = order.buyerId === userId;
  const isAdmin = role === "ADMIN";
  if (!isBuyer && !isAdmin) {
    return NextResponse.json({ error: "Only the buyer or an admin can release this payment" }, { status: 403 });
  }

  // A buyer can only confirm early once the seller has actually marked
  // the work complete - they can't skip straight from IN_ESCROW to
  // released. An admin can override this (dispute resolution).
  const validStatus = isAdmin ? ["IN_ESCROW", "COMPLETED"].includes(order.status) : order.status === "COMPLETED";
  if (!validStatus) {
    return NextResponse.json(
      { error: isBuyer ? "Your coach hasn't marked this complete yet" : `Order isn't releasable (currently ${order.status})` },
      { status: 400 }
    );
  }

  try {
    const result = await releaseOrder(order.id);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof FundsNotYetAvailableError) {
      const readable = err.availableAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return NextResponse.json(
        { error: `Your payment is still settling with our payment processor - this will complete automatically around ${readable}, no action needed.` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message || "Release failed" }, { status: 400 });
  }
}
