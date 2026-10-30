import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INTRO_CALL_MINUTES } from "@/lib/options";
import { bookingWindowFor, hasAvailability } from "@/lib/schedule";
import { tzOrDefault } from "@/lib/tz";
import { introBlockReason, loadIntroMentor, openIntroSlots } from "@/lib/introCalls";

export const dynamic = "force-dynamic";

// Open 15-minute times for a free intro call with this mentor (their call
// hours minus their other calls, buffers, notice, days off, busy dates and
// their own calendar's busy times), for the logged-in student.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Log in with a student account to book an intro call" }, { status: 401 });
  }
  const studentId = (session.user as any).id;
  const mentor = await loadIntroMentor(params.id);
  const blocked = await introBlockReason(studentId, mentor);
  if (blocked || !mentor) return NextResponse.json({ error: blocked || "That mentor doesn't exist" }, { status: 403 });
  const slots = await openIntroSlots(mentor, studentId);
  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    lengthMinutes: INTRO_CALL_MINUTES,
    hasAvailability: hasAvailability(mentor.weeklyHours),
    bookingWindowDays: bookingWindowFor(mentor.bookingWindowDays),
    timeZone: tzOrDefault(mentor.timeZone),
  });
}
