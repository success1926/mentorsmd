import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeIcalUrl } from "@/lib/icalBusy";
import { externalBusyFor, mentorScheduleSelect } from "@/lib/callBooking";

// Mentor-only: block busy times from their own Google / iCloud calendar.
// They paste the calendar's SECRET iCal address; we read it (at most every
// 15 minutes) and hide those times from the slot picker. Nothing is ever
// written to their calendar, and event titles aren't stored.
async function requireMentor() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") return null;
  return (session.user as any).id as string;
}

// Body: { url } to connect (or replace), or { refresh: true } to re-read now.
export async function POST(req: Request) {
  const userId = await requireMentor();
  if (!userId) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.url !== undefined) {
    const url = normalizeIcalUrl(body.url);
    if (!url) return NextResponse.json({ error: "Paste the full secret address, starting with https:// (or webcal://)" }, { status: 400 });
    await prisma.user.update({ where: { id: userId }, data: { externalCalUrl: url, externalBusy: [], externalBusyFetchedAt: null, externalCalError: null } });
  }
  const mentor = await prisma.user.findUnique({ where: { id: userId }, select: mentorScheduleSelect });
  if (!mentor?.externalCalUrl) return NextResponse.json({ error: "No calendar connected" }, { status: 400 });
  try {
    const busy = await externalBusyFor(mentor, true);
    return NextResponse.json({ ok: true, busyCount: busy.length, host: new URL(mentor.externalCalUrl).hostname });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Couldn't read that calendar" }, { status: 400 });
  }
}

export async function DELETE() {
  const userId = await requireMentor();
  if (!userId) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  await prisma.user.update({
    where: { id: userId },
    data: { externalCalUrl: null, externalBusy: [], externalBusyFetchedAt: null, externalCalError: null },
  });
  return NextResponse.json({ ok: true });
}
