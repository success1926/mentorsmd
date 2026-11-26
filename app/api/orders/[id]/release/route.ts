import { NextResponse } from "next/server";
import { adminCan } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { closeDisputeFlag } from "@/lib/flags";
import { FinishError, adminApprove, studentResponds } from "@/lib/orderFinish";
import { requireUser } from "@/lib/session";

// Approving a package for the mentor. Two ways a human reaches this:
//   1. The student approves once the mentor marked the work complete.
//   2. An admin approves while resolving a dispute.
// A third way - automatic approval once the student's 48 hours pass - does
// NOT come through this route, since there's no logged-in user in that
// context. It's runAutoApprovals() in lib/orderFinish.ts, run every 15
// minutes by /api/cron/call-reminders.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const userId = me.id;
  const role = me.role;
  const isBuyer = order.buyerId === userId;
  // Admins release money only with the Orders permission (lib/adminPermissions.ts).
  const isAdmin = role === "ADMIN" && (await adminCan("orders"));
  if (!isBuyer && !isAdmin) {
    return NextResponse.json({ error: "Only the student on this order or an admin can release this payment" }, { status: 403 });
  }

  // Packages are approved, not released: the mentor is paid with the
  // monthly payout (lib/orderFinish.ts).
  if (!order.kind) return NextResponse.json({ error: "Order not found" }, { status: 404 });
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
