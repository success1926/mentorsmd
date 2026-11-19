import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dueDayOf } from "@/lib/schedule";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// "My calendar": the logged-in person's upcoming and recent calls, and for
// mentors their order due dates and busy dates.
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const isMentor = role === "SELLER";
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 24 * 3600_000);

  // Upcoming and past calls are read separately, so a busy mentor's many
  // past calls can never push upcoming ones past the limit.
  const callWhere: Prisma.CallBookingWhereInput = {
    status: "BOOKED",
    OR: [
      { order: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } } },
      // Free intro calls (no order).
      { kind: "INTRO", OR: [{ studentId: userId }, { mentorId: userId }] },
    ],
  };
  const callInclude = {
    order: {
      select: {
        id: true, buyerId: true, sellerId: true, packageTitle: true, disputed: true,
        gig: { select: { title: true } },
        buyer: { select: { name: true, photoUrl: true } },
        seller: { select: { name: true, photoUrl: true } },
      },
    },
    student: { select: { name: true, photoUrl: true } },
    mentor: { select: { name: true, photoUrl: true } },
  } satisfies Prisma.CallBookingInclude;

  const [upcomingCalls, pastCalls, dueOrders, busyDates, me] = await Promise.all([
    prisma.callBooking.findMany({
      where: { ...callWhere, endTime: { gt: now } },
      include: callInclude,
      orderBy: { startTime: "asc" },
      take: 1000,
    }),
    // The last 60 days, newest first.
    prisma.callBooking.findMany({
      where: { ...callWhere, endTime: { lte: now }, startTime: { gte: since } },
      include: callInclude,
      orderBy: { startTime: "desc" },
      take: 200,
    }),
    isMentor
      ? prisma.order.findMany({
          where: { sellerId: userId, status: "IN_ESCROW", dueDate: { not: null }, kind: null },
          select: { id: true, dueDate: true, callHoldAt: true, revisionRequested: true, gig: { select: { title: true } }, buyer: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 200,
        })
      : Promise.resolve([]),
    isMentor
      ? prisma.busyDate.findMany({ where: { userId, endDay: { gte: now.toISOString().slice(0, 10) } }, orderBy: { startDay: "asc" }, take: 100 })
      : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true, calendarToken: true } }),
  ]);

  const view = (b: (typeof upcomingCalls)[number]) => {
    const iAmMentor = b.order ? b.order.sellerId === userId : b.mentorId === userId;
    return {
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime,
      orderId: b.orderId,
      title: b.order ? b.order.packageTitle || b.order.gig.title : "Free 15-minute intro call",
      withName: b.order ? (iAmMentor ? b.order.buyer.name : b.order.seller.name) : (iAmMentor ? b.student?.name : b.mentor?.name) || "",
      withRole: iAmMentor ? "student" : "mentor",
      // For the student calendar's Reschedule / Cancel (student area v2).
      kind: b.kind,
      withId: b.order ? (iAmMentor ? b.order.buyerId : b.order.sellerId) : (iAmMentor ? b.studentId : b.mentorId),
      withPhotoUrl: (b.order ? (iAmMentor ? b.order.buyer.photoUrl : b.order.seller.photoUrl) : (iAmMentor ? b.student?.photoUrl : b.mentor?.photoUrl)) || null,
      disputed: !!b.order?.disputed,
    };
  };
  return NextResponse.json({
    role,
    timeZone: me?.timeZone || null,
    feedConnected: !!me?.calendarToken,
    upcoming: upcomingCalls.map(view),
    past: pastCalls.map(view),
    dueDates: (dueOrders as any[]).map((o) => ({
      orderId: o.id,
      dueDay: dueDayOf(o.dueDate),
      title: o.gig.title,
      studentName: o.buyer.name,
      onHold: !!o.callHoldAt,
      revision: o.revisionRequested,
    })),
    busyDates: (busyDates as any[]).map((b) => ({ id: b.id, startDay: b.startDay, endDay: b.endDay, kind: b.kind, note: b.note })),
  });
}
