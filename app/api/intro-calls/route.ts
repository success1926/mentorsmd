import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseDate } from "@/lib/validate";
import { CallError } from "@/lib/callBooking";
import { bookIntroCall } from "@/lib/introCalls";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

// Books the student's free 15-minute intro call with a mentor
// (lib/introCalls.ts): { mentorId, startTime }. One per student and mentor.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can book an intro call" }, { status: 403 });
  }
  const studentId = (session.user as any).id;
  const r = await rateLimit(RATE_LIMITS.messagesPerMinute, `intro:${studentId}`);
  if (!r.ok) return tooMany(r.retryAfterSec, "Please wait a moment and try again.");

  const body = await req.json().catch(() => ({}));
  if (typeof body.mentorId !== "string") return NextResponse.json({ error: "That mentor doesn't exist" }, { status: 404 });
  const start = parseDate(body.startTime, { maxDaysAhead: 120 });
  if (!start) return NextResponse.json({ error: "Pick a time" }, { status: 400 });
  try {
    const { booking, conversationId } = await bookIntroCall(studentId, body.mentorId, start);
    return NextResponse.json({ booking: { id: booking.id, startTime: booking.startTime, endTime: booking.endTime, status: booking.status }, conversationId });
  } catch (err) {
    if (err instanceof CallError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Intro call booking failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
