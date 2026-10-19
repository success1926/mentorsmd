import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { afterOutcome, bookingForOutcome } from "@/lib/callOutcomeRunner";
import { CallOutcome, outcomeLabel } from "@/lib/callOutcomes";

export const dynamic = "force-dynamic";

// Admin -> Calls & recordings: change what happened at a past call.
//   HELD            "Count as held"        (the call is used)
//   FREE_REBOOK     "Give a free rebook"   (the call doesn't count; no emails)
//   STUDENT_NO_SHOW "Mark student no-show" (the call is used; emails both)
//   MENTOR_NO_SHOW  "Mark mentor no-show"  (free rebook; emails both, and a
//                    second one on the order opens the refund dispute)
const ALLOWED: CallOutcome[] = ["HELD", "FREE_REBOOK", "STUDENT_NO_SHOW", "MENTOR_NO_SHOW"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("calls");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const outcome = body?.outcome as CallOutcome;
  if (!ALLOWED.includes(outcome)) return NextResponse.json({ error: "Pick an outcome" }, { status: 400 });

  const booking = await bookingForOutcome(params.id);
  if (!booking) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  // Free intro calls have no order (their outcome is set automatically).
  if (!booking.order) return NextResponse.json({ error: "Intro calls can't be changed here" }, { status: 400 });
  if (booking.status === "CANCELLED") return NextResponse.json({ error: "This call was cancelled" }, { status: 400 });
  if (booking.endTime.getTime() > Date.now()) return NextResponse.json({ error: "This call hasn't ended yet" }, { status: 400 });
  if (booking.outcome === outcome) return NextResponse.json({ ok: true, outcome });

  const res = await prisma.callBooking.updateMany({
    where: { id: booking.id, outcome: booking.outcome },
    data: { outcome, outcomeAt: new Date(), outcomeById: admin.id },
  });
  if (!res.count) return NextResponse.json({ error: "This call just changed. Refresh the page." }, { status: 409 });

  await logAdminAction({
    adminId: admin.id,
    action: "CALL_OUTCOME",
    summary: `Call on ${booking.startTime.toISOString().slice(0, 10)} for "${booking.order.gig.title}" (${booking.order.buyer.name} with ${booking.order.seller.name}): ${outcomeLabel(outcome)}${booking.outcome ? ` (was: ${outcomeLabel(booking.outcome)})` : ""}`,
    targetType: "ORDER",
    targetId: booking.order.id,
    targetUserId: booking.order.sellerId,
    details: { bookingId: booking.id, from: booking.outcome, to: outcome },
  });

  await afterOutcome(booking, outcome);
  return NextResponse.json({ ok: true, outcome });
}
