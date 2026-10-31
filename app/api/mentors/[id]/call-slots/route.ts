import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mentorScheduleSelect, openSlotsFor } from "@/lib/callBooking";
import { bookingWindowFor, hasAvailability } from "@/lib/schedule";
import { tzOrDefault } from "@/lib/tz";
import { isBlockMinutes } from "@/lib/hours";
import { bookablePackages, payPerCallOffer } from "@/lib/bookFromHours";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// "Book a call" with a mentor (?minutes=30|60): open times on their
// calendar, the student's packages with hours left, and the pay-per-call
// price for when there are none (lib/bookFromHours.ts).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Log in with a student account to book a call" }, { status: 401 });
  }
  const studentId = (session.user as any).id;
  const minutes = Number(new URL(req.url).searchParams.get("minutes") || 60);
  if (!isBlockMinutes(minutes)) return NextResponse.json({ error: "Pick a 30- or 60-minute call" }, { status: 400 });
  const mentor = await prisma.user.findUnique({ where: { id: params.id }, select: { ...mentorScheduleSelect, role: true } });
  if (!mentor || mentor.role !== "SELLER") return NextResponse.json({ error: "That mentor doesn't exist" }, { status: 404 });
  const [packages, payPerCall] = await Promise.all([bookablePackages(studentId, mentor.id), payPerCallOffer(studentId, mentor.id)]);
  const canBook = packages.some((p) => p.left >= minutes) || !!payPerCall?.available;
  const slots = canBook ? await openSlotsFor(mentor, studentId, minutes) : [];
  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    lengthMinutes: minutes,
    hasAvailability: hasAvailability(mentor.weeklyHours),
    bookingWindowDays: bookingWindowFor(mentor.bookingWindowDays),
    timeZone: tzOrDefault(mentor.timeZone),
    packages,
    payPerCall,
  });
}
