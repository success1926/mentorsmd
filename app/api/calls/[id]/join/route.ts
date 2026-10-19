import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinState, JOIN_CLOSES_MINUTES_AFTER, JOIN_OPENS_MINUTES_BEFORE } from "@/lib/calls";
import { createMeetingToken, dailyConfigured, ensureRoom } from "@/lib/daily";
import { blockBetween } from "@/lib/blocks";

// The Join button. Calls happen in a private Daily room; each person gets
// their own meeting token (with their name), and only:
//   - if they're the student or the mentor on the order (or on the free
//     intro call, which has no order), and
//   - from 10 minutes before the start until 30 minutes after the end.
// The token itself also stops working shortly after the call.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const booking = await prisma.callBooking.findUnique({
    where: { id: params.id },
    include: {
      order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } },
      student: { select: { name: true } },
      mentor: { select: { name: true } },
    },
  });
  const studentId = booking?.order?.buyerId ?? booking?.studentId;
  const mentorId = booking?.order?.sellerId ?? booking?.mentorId;
  if (!booking || (studentId !== userId && mentorId !== userId)) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (booking.status !== "BOOKED") return NextResponse.json({ error: "This call was cancelled" }, { status: 400 });
  if (booking.order && !["IN_ESCROW", "COMPLETED"].includes(booking.order.status)) {
    return NextResponse.json({ error: "This order is no longer active" }, { status: 400 });
  }
  const state = joinState(booking);
  if (state === "early") {
    return NextResponse.json({ error: `The call opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before it starts` }, { status: 400 });
  }
  if (state === "ended") {
    return NextResponse.json({ error: `This call has ended (the room closes ${JOIN_CLOSES_MINUTES_AFTER} minutes after the scheduled end)` }, { status: 400 });
  }
  // A block (e.g. after a report) also closes calls already booked.
  const blocks = await blockBetween(studentId!, mentorId!);
  if (blocks.iBlocked || blocks.theyBlocked) {
    return NextResponse.json({ error: "This call isn't available. Contact us if you need help." }, { status: 403 });
  }
  // Either person paused for review (safety hold) or removed: no calls.
  const held = await prisma.user.count({
    where: { id: { in: [studentId!, mentorId!] }, OR: [{ safetyHoldAt: { not: null } }, { removedByAdmin: true }] },
  });
  if (held) return NextResponse.json({ error: "This call isn't available. Contact us if you need help." }, { status: 403 });
  if (!dailyConfigured()) {
    return NextResponse.json({ error: "Video isn't set up yet. Message the other person, or contact us." }, { status: 503 });
  }

  // The room is made at booking; make sure it exists, is private and stays
  // open until this booking's end (a moved call may have an old closing
  // time). If Daily has a blip, fall back to the saved room.
  const room = (await ensureRoom(booking)) || (booking.roomName && booking.roomUrl ? { name: booking.roomName, url: booking.roomUrl } : null);
  if (!room) return NextResponse.json({ error: "Couldn't open the video room. Try again in a moment." }, { status: 502 });
  const roomName = room.name;
  const roomUrl = room.url;
  if (booking.roomName !== roomName || booking.roomUrl !== roomUrl) {
    await prisma.callBooking.update({ where: { id: booking.id }, data: { roomName, roomUrl } });
  }

  const isMentor = mentorId === userId;
  const name = (booking.order ? (isMentor ? booking.order.seller.name : booking.order.buyer.name) : isMentor ? booking.mentor?.name : booking.student?.name) || (isMentor ? "Mentor" : "Student");
  const token = await createMeetingToken({
    roomName,
    userId,
    userName: `${name} (${isMentor ? "mentor" : "student"})`,
    start: booking.startTime,
    end: booking.endTime,
  });
  if (!token) return NextResponse.json({ error: "Couldn't open the video room. Try again in a moment." }, { status: 502 });

  return NextResponse.json({ url: `${roomUrl}?t=${encodeURIComponent(token)}` });
}
