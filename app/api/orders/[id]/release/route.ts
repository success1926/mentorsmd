import { NextResponse } from "next/server";
import { adminCan } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { closeDisputeFlag } from "@/lib/flags";
import { FinishError, adminApprove, studentResponds } from "@/lib/orderFinish";
import { releaseOrder, FundsNotYetAvailableError, OrderStateChangedError } from "@/lib/orderRelease";
import { getSession } from "@/lib/session";

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
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const isBuyer = order.buyerId === userId;
  // Admins release money only with the Orders permission (lib/adminPermissions.ts).
  const isAdmin = role === "ADMIN" && (await adminCan("orders"));
  if (!isBuyer && !isAdmin) {
    return NextResponse.json({ error: "Only the student on this order or an admin can release this payment" }, { status: 403 });
  }

  // Hours packages (redesign Oct 2026) are approved, not released: the
  // mentor is paid with the monthly payout (lib/orderFinish.ts).
  if (order.kind) {
    try {
      if (isAdmin) {
        await adminApprove(order.id);
        await logAdminAction({
          adminId: userId,
          action: "ORDER_RELEASE",
          summary: `Approved package ${order.id} for the mentor${order.disputed ? " to resolve a dispute" : ""} (paid with the monthly payout)`,
          targetType: "ORDER",
          targetId: order.id,
          targetUserId: order.sellerId,
        });
        if (order.disputed) await closeDisputeFlag(order.id, "RELEASE", userId);
      } else {
        await studentResponds(order.id, userId, "APPROVE", "");
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof FinishError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  }

  if (isBuyer && !isAdmin && order.disputed) {
    return NextResponse.json({ error: "This order has an open dispute - an admin will resolve it" }, { status: 400 });
  }

  // A buyer can only confirm early once the seller has actually marked
  // the work complete - they can't skip straight from IN_ESCROW to
  // released. An admin can override this (dispute resolution).
  const validStatus = isAdmin ? ["IN_ESCROW", "COMPLETED"].includes(order.status) : order.status === "COMPLETED";
  if (!validStatus) {
    return NextResponse.json(
      { error: isBuyer ? "Your mentor hasn't marked this complete yet" : `Order isn't releasable (currently ${order.status})` },
      { status: 400 }
    );
  }

  try {
    // Re-check the same condition atomically at claim time, so a revision
    // request or refund that lands between the check above and now wins.
    const result = await releaseOrder(order.id, isAdmin ? {} : { status: "COMPLETED", buyerId: userId, disputed: false });
    if (order.disputed) {
      await prisma.order
        .update({ where: { id: order.id }, data: { disputeResolvedAt: new Date(), disputeResolution: "RELEASED" } })
        .catch((e) => console.error("Couldn't stamp dispute resolution:", e));
    }
    if (isAdmin) {
      await logAdminAction({
        adminId: userId,
        action: "ORDER_RELEASE",
        summary: `Released payment for order ${order.id} to the mentor${order.disputed ? " to resolve a dispute" : ""}`,
        targetType: "ORDER",
        targetId: order.id,
        targetUserId: order.sellerId,
      });
      if (order.disputed) await closeDisputeFlag(order.id, "RELEASE", userId);
    }
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof OrderStateChangedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof FundsNotYetAvailableError) {
      const readable = err.availableAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return NextResponse.json(
        { error: `Your payment is still settling with our payment processor - this will complete automatically around ${readable}, no action needed.` },
        { status: 400 }
      );
    }
    console.error(`Release failed for order ${order.id}:`, err);
    return NextResponse.json({ error: err.message || "Release failed" }, { status: 400 });
  }
}
