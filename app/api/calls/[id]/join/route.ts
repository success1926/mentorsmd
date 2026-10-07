import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinState, JOIN_CLOSES_MINUTES_AFTER, JOIN_OPENS_MINUTES_BEFORE } from "@/lib/calls";
import { createMeetingToken, dailyConfigured, ensureRoom } from "@/lib/daily";

// The Join button. Calls happen in a private Daily room; each person gets
// their own meeting token (with their name), and only:
//   - if they're the student or the mentor on the order, and
//   - from 10 minutes before the start until 30 minutes after the end.
// The token itself also stops working shortly after the call.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const booking = await prisma.callBooking.findUnique({
    where: { id: params.id },
    include: { order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
  });
  if (!booking || (booking.order.buyerId !== userId && booking.order.sellerId !== userId)) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (booking.status !== "BOOKED") return NextResponse.json({ error: "This call was cancelled" }, { status: 400 });
  if (!["IN_ESCROW", "COMPLETED"].includes(booking.order.status)) {
    return NextResponse.json({ error: "This order is no longer active" }, { status: 400 });
  }
  const state = joinState(booking);
  if (state === "early") {
    return NextResponse.json({ error: `The call opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before it starts` }, { status: 400 });
  }
  if (state === "ended") {
    return NextResponse.json({ error: `This call has ended (the room closes ${JOIN_CLOSES_MINUTES_AFTER} minutes after the scheduled end)` }, { status: 400 });
  }
  if (!dailyConfigured()) {
    return NextResponse.json({ error: "Video isn't set up yet. Message the other person, or contact us." }, { status: 503 });
  }

  // The room is made at booking; make sure it exists (and is private) now.
  let roomName = booking.roomName;
  let roomUrl = booking.roomUrl;
  if (!roomName || !roomUrl) {
    const room = await ensureRoom(booking);
    if (!room) return NextResponse.json({ error: "Couldn't open the video room. Try again in a moment." }, { status: 502 });
    roomName = room.name;
    roomUrl = room.url;
    await prisma.callBooking.update({ where: { id: booking.id }, data: { roomName, roomUrl } });
  }

  const isMentor = booking.order.sellerId === userId;
  const name = (isMentor ? booking.order.seller.name : booking.order.buyer.name) || (isMentor ? "Mentor" : "Student");
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
