import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinState, JOIN_OPENS_MINUTES_BEFORE } from "@/lib/calls";

// The Join button on a booked call. There's no always-on video anymore:
// a room only exists for a call that was booked on a paid order, and only
// opens from 10 minutes before the start until shortly after the end.
//
// If Cal.com created its own video link for the booking (Cal Video, Zoom,
// Google Meet), that link is used. Otherwise we create a Daily.co room
// named after the booking, so both people land in the same room.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { bookingId } = await req.json().catch(() => ({}));
  if (typeof bookingId !== "string") return NextResponse.json({ error: "Missing call" }, { status: 400 });

  const userId = (session.user as any).id;
  const booking = await prisma.callBooking.findUnique({ where: { id: bookingId }, include: { order: true } });
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
  if (state === "ended") return NextResponse.json({ error: "This call has ended" }, { status: 400 });

  if (booking.meetingUrl) return NextResponse.json({ url: booking.meetingUrl });

  if (!process.env.DAILY_API_KEY) {
    return NextResponse.json({ error: "Video isn't set up yet - message the other person to share a link" }, { status: 500 });
  }

  const name = `mmd-${booking.id}`.slice(0, 40);
  const headers = { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" };

  // Reuse the room if the other person already opened it.
  const existing = await fetch(`https://api.daily.co/v1/rooms/${name}`, { headers });
  if (existing.ok) {
    const room = await existing.json();
    return NextResponse.json({ url: room.url });
  }

  const exp = Math.floor(new Date(booking.endTime).getTime() / 1000) + 60 * 60; // an hour past the scheduled end
  const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      privacy: "public", // the room name is unguessable and only shown to the two people on the order
      properties: { exp, enable_chat: false, max_participants: 2 },
    }),
  });
  if (!dailyRes.ok) {
    const errText = await dailyRes.text();
    return NextResponse.json({ error: `Couldn't create the video room: ${errText}` }, { status: 502 });
  }
  const room = await dailyRes.json();
  return NextResponse.json({ url: room.url });
}
