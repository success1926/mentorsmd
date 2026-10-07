import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUFFER_OPTIONS, NOTICE_OPTIONS, hasAvailability, parseWeeklyHours } from "@/lib/schedule";
import { isDayString, isValidTimeZone } from "@/lib/tz";

// Mentor-only: call availability for the built-in calendar.
// Body: { weeklyHours, timeZone, bufferMinutes, minNoticeHours, daysOff }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const weeklyHours = parseWeeklyHours(body.weeklyHours);
  if (!weeklyHours) {
    return NextResponse.json({ error: "Check your hours: each block must end after it starts, and blocks on the same day can't overlap." }, { status: 400 });
  }
  if (!isValidTimeZone(body.timeZone)) return NextResponse.json({ error: "Pick your time zone" }, { status: 400 });
  const bufferMinutes = Number(body.bufferMinutes);
  if (!BUFFER_OPTIONS.includes(bufferMinutes)) return NextResponse.json({ error: "Pick a buffer" }, { status: 400 });
  const minNoticeHours = Number(body.minNoticeHours);
  if (!NOTICE_OPTIONS.includes(minNoticeHours)) return NextResponse.json({ error: "Pick the minimum notice" }, { status: 400 });
  const daysOff = Array.isArray(body.daysOff) ? Array.from(new Set(body.daysOff as unknown[])) : [];
  if (daysOff.length > 200 || !daysOff.every(isDayString)) return NextResponse.json({ error: "One of your days off isn't a valid date" }, { status: 400 });
  const today = new Date(Date.now() - 2 * 24 * 3600_000).toISOString().slice(0, 10);

  const user = await prisma.user.update({
    where: { id: (session.user as any).id },
    data: {
      weeklyHours,
      timeZone: body.timeZone,
      bufferMinutes,
      minNoticeHours,
      // Past days off are dropped.
      daysOff: (daysOff as string[]).filter((d) => d >= today).sort(),
    },
    select: { weeklyHours: true, timeZone: true, bufferMinutes: true, minNoticeHours: true, daysOff: true },
  });
  return NextResponse.json({ schedule: user, hasAvailability: hasAvailability(user.weeklyHours) });
}
