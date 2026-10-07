import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWorkCompleteEmail, SITE_URL } from "@/lib/email";
import { callSummary } from "@/lib/calls";
import { parseDelivery } from "@/lib/deliveries";

// This is now the ONLY way an order moves out of IN_ESCROW under normal
// circumstances - the seller says the work is done, which starts the
// 96-hour clock. From here: the buyer can confirm early (immediate
// release, see /api/orders/[id]/release) or do nothing, in which case
// /api/cron/auto-release picks it up once 96 hours have passed.
//
// Every call saves a Delivery (a required description plus optional
// files already uploaded through /api/upload). A revision request sends
// the order back here, and the next delivery becomes Delivery 2, 3...
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { buyer: true, gig: true, callBookings: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.sellerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Only the mentor on this order can mark it complete" }, { status: 403 });
  }
  if (order.status !== "IN_ESCROW") {
    return NextResponse.json({ error: `Order isn't awaiting completion (currently ${order.status})` }, { status: 400 });
  }

  if (order.disputed) {
    return NextResponse.json({ error: "This order has an open dispute - an admin will resolve it" }, { status: 400 });
  }

  // Calls included in the package have to happen first (or be skipped by
  // the student, or forfeited after the 48-hour booking window).
  const calls = callSummary(order);
  if (!calls.satisfied) {
    return NextResponse.json(
      {
        error:
          calls.toBook > 0
            ? "This package includes a call that hasn't been booked yet. You can mark it complete once the call happens."
            : "This package includes a call that hasn't happened yet. You can mark it complete after the call.",
      },
      { status: 400 }
    );
  }

  const parsed = parseDelivery(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Conditional update so a refund landing at the same moment can't be
  // overwritten back to COMPLETED. The delivery is saved in the same
  // transaction, so there's never a "delivered" order without one.
  let delivery;
  try {
    delivery = await prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { id: params.id, status: "IN_ESCROW", disputed: false },
        data: { status: "COMPLETED", workCompletedAt: new Date() },
      });
      if (claim.count === 0) return null;
      const count = await tx.delivery.count({ where: { orderId: params.id } });
      return tx.delivery.create({
        data: { orderId: params.id, number: count + 1, description: parsed.description, files: parsed.files },
      });
    });
  } catch (err) {
    // Two clicks at once can both try to save "Delivery N"; the unique
    // index stops the second one.
    console.error("Failed to save delivery:", err);
    return NextResponse.json({ error: "This order changed - refresh the page" }, { status: 409 });
  }
  if (!delivery) {
    return NextResponse.json({ error: "This order changed - refresh the page" }, { status: 409 });
  }
  const updated = await prisma.order.findUnique({ where: { id: params.id } });

  try {
    await sendWorkCompleteEmail(order.buyer.email, order.gig.title, `${SITE_URL}/orders/${order.id}`, {
      number: delivery.number,
      description: parsed.description,
      files: parsed.files,
    });
  } catch (err) {
    console.error("Failed to send work-complete email:", err);
  }

  return NextResponse.json({ order: updated, delivery });
}
