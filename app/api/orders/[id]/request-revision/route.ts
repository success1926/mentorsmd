import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendRevisionRequestedEmail, SITE_URL } from "@/lib/email";

const REVISION_WINDOW_DAYS = 7;

// Lightweight - a flag + note, not a whole versioning system. Works in
// two states:
//   - IN_ESCROW: buyer flags something before the seller has even marked
//     work complete (e.g. spotted a problem via messages).
//   - COMPLETED: buyer is in their 96-hour review window and isn't happy
//     with what they got. Requesting a revision here resets the order
//     back to IN_ESCROW and clears workCompletedAt - this is important:
//     without it, the 96-hour auto-release cron would still fire off the
//     original completion timestamp and pay the seller regardless of the
//     revision request.
//
// Every revision request also pushes the due date out to exactly 7 days
// from the moment it's submitted, overwriting whatever the due date was
// before. If 7 days genuinely isn't enough for a given revision, the
// seller can move it further out themselves via
// /api/orders/[id]/due-date.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { seller: true, gig: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.buyerId !== (session.user as any).id) {
    return NextResponse.json({ error: "Only the buyer can request a revision" }, { status: 403 });
  }
  if (!["IN_ESCROW", "COMPLETED"].includes(order.status)) {
    return NextResponse.json({ error: "Revisions can only be requested on a pending or just-completed order" }, { status: 400 });
  }

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "Add a note describing what needs to change" }, { status: 400 });

  const wasCompleted = order.status === "COMPLETED";
  const newDueDate = new Date(Date.now() + REVISION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      revisionRequested: true,
      revisionNote: note,
      dueDate: newDueDate,
      // Stop the 96-hour clock if it was running.
      ...(wasCompleted ? { status: "IN_ESCROW", workCompletedAt: null } : {}),
    },
  });

  try {
    await sendRevisionRequestedEmail(order.seller.email, order.gig.title, note, `${SITE_URL}/orders/${order.id}`);
  } catch (err) {
    console.error("Failed to send revision-requested email:", err);
  }

  return NextResponse.json({ order: updated });
}
