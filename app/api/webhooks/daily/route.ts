import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDailyWebhook } from "@/lib/daily";

// Daily.co sends call events here:
//   participant.joined / participant.left -> the attendance log
//   recording.started / recording.ready-to-download / recording.error -> recordings
//
// Setup (once): Admin -> Calls & recordings -> "Connect Daily webhook", or
// create a webhook in Daily pointing at https://<your site>/api/webhooks/daily.
// Then save the secret it shows as DAILY_WEBHOOK_SECRET in Vercel, so
// events that don't come from Daily are refused.
function toDate(v: unknown): Date | null {
  if (typeof v === "number" && v > 0) return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string" && v) {
    const d = new Date(/^\d+(\.\d+)?$/.test(v) ? Number(v) * 1000 : v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function bookingForRoom(room: unknown) {
  if (typeof room !== "string" || !room) return null;
  return prisma.callBooking.findFirst({
    where: { roomName: room },
    select: { id: true, order: { select: { buyerId: true, sellerId: true } } },
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: true }); // Daily's set-up test ping isn't always JSON
  }
  // Daily checks the address works when the webhook is created, with a
  // test request that has no event type.
  if (!event?.type) return NextResponse.json({ ok: true });

  if (!verifyDailyWebhook(body, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const p = event.payload || {};
  try {
    if (event.type === "participant.joined" || event.type === "participant.left") {
      const booking = await bookingForRoom(p.room);
      const sessionId = typeof p.session_id === "string" ? p.session_id : null;
      if (!booking || !sessionId) return NextResponse.json({ ok: true, ignored: "unknown room" });
      const userId = typeof p.user_id === "string" && [booking.order.buyerId, booking.order.sellerId].includes(p.user_id) ? p.user_id : null;
      const joinedAt = toDate(p.joined_at) || toDate(event.event_ts) || new Date();
      const left = event.type === "participant.left";
      const duration = typeof p.duration === "number" ? Math.round(p.duration) : null;
      const leftAt = left ? (duration !== null ? new Date(joinedAt.getTime() + duration * 1000) : toDate(event.event_ts) || new Date()) : null;
      await prisma.callAttendance.upsert({
        where: { sessionId },
        create: {
          sessionId,
          bookingId: booking.id,
          userId,
          name: typeof p.user_name === "string" ? p.user_name.slice(0, 100) : null,
          joinedAt,
          leftAt,
          durationSec: duration,
        },
        update: left ? { leftAt, durationSec: duration } : {},
      });
      return NextResponse.json({ ok: true });
    }

    if (event.type.startsWith("recording.")) {
      const recordingId = typeof p.recording_id === "string" ? p.recording_id : null;
      const booking = await bookingForRoom(p.room_name || p.room);
      if (!recordingId || !booking) return NextResponse.json({ ok: true, ignored: "unknown recording" });
      const status = event.type === "recording.ready-to-download" ? "ready" : event.type === "recording.error" ? "error" : "recording";
      await prisma.callRecording.upsert({
        where: { dailyRecordingId: recordingId },
        create: {
          dailyRecordingId: recordingId,
          bookingId: booking.id,
          status,
          startedAt: toDate(p.start_ts),
          durationSec: typeof p.duration === "number" ? Math.round(p.duration) : null,
        },
        update: {
          status,
          ...(typeof p.duration === "number" ? { durationSec: Math.round(p.duration) } : {}),
          ...(toDate(p.start_ts) ? { startedAt: toDate(p.start_ts) } : {}),
        },
      });
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Daily webhook failed", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
