import { NextResponse } from "next/server";
import { adminCan } from "@/lib/adminTeam";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INTRO_TITLE } from "@/lib/introCalls";

export const dynamic = "force-dynamic";

// One call, for the pre-join screen. Only the student and mentor on the
// call (and admins) can see it. A free intro call (kind INTRO) has no
// order: its people are on the call itself.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = session.user as any;

  const booking = await prisma.callBooking.findUnique({
    where: { id: params.id },
    include: {
      order: {
        select: {
          id: true, status: true, buyerId: true, sellerId: true, packageTitle: true,
          gig: { select: { title: true, callLength: true } },
          buyer: { select: { name: true } },
          seller: { select: { name: true, photoUrl: true } },
        },
      },
      student: { select: { id: true, name: true } },
      mentor: { select: { id: true, name: true } },
    },
  });
  const studentId = booking?.order?.buyerId ?? booking?.studentId;
  const mentorId = booking?.order?.sellerId ?? booking?.mentorId;
  if (!booking || (studentId !== user.id && mentorId !== user.id && !(user.role === "ADMIN" && (await adminCan("calls"))))) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  const isMentor = mentorId === user.id;
  const intro = !booking.order;
  let backHref = booking.order ? `/orders/${booking.order.id}` : `/mentors/${mentorId}`;
  if (intro && studentId && mentorId) {
    const convo = await prisma.conversation.findUnique({ where: { buyerId_sellerId: { buyerId: studentId, sellerId: mentorId } }, select: { id: true } });
    if (convo) backHref = `/messages/${convo.id}`;
  }
  return NextResponse.json({
    call: {
      id: booking.id,
      kind: intro ? "INTRO" : "ORDER",
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      orderId: booking.order?.id ?? null,
      // Intro calls have no order, so they're always "active".
      orderStatus: booking.order ? booking.order.status : "IN_ESCROW",
      title: booking.order ? booking.order.packageTitle || booking.order.gig.title : INTRO_TITLE,
      otherName: booking.order
        ? isMentor ? booking.order.buyer.name : booking.order.seller.name
        : (isMentor ? booking.student?.name : booking.mentor?.name) || "",
      canJoin: studentId === user.id || isMentor,
      backHref,
      backLabel: booking.order ? "← Back to the order" : "← Back to your messages",
    },
  });
}
