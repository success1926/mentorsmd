import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dueDayOf } from "@/lib/schedule";

export const dynamic = "force-dynamic";

// "My calendar": the logged-in person's upcoming and recent calls, and for
// mentors their order due dates and busy dates.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const isMentor = role === "SELLER";
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 24 * 3600_000);

  const [calls, dueOrders, busyDates, me] = await Promise.all([
    prisma.callBooking.findMany({
      where: {
        status: "BOOKED",
        startTime: { gte: since },
        order: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } },
      },
      include: {
        order: {
          select: {
            id: true, buyerId: true, sellerId: true,
            gig: { select: { title: true } },
            buyer: { select: { name: true } },
            seller: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: "asc" },
      take: 300,
    }),
    isMentor
      ? prisma.order.findMany({
          where: { sellerId: userId, status: "IN_ESCROW", dueDate: { not: null } },
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

  const view = (b: (typeof calls)[number]) => ({
    id: b.id,
    startTime: b.startTime,
    endTime: b.endTime,
    orderId: b.orderId,
    title: b.order.gig.title,
    withName: b.order.sellerId === userId ? b.order.buyer.name : b.order.seller.name,
    withRole: b.order.sellerId === userId ? "student" : "mentor",
  });
  return NextResponse.json({
    role,
    timeZone: me?.timeZone || null,
    feedConnected: !!me?.calendarToken,
    upcoming: calls.filter((b) => b.endTime > now).map(view),
    past: calls.filter((b) => b.endTime <= now).reverse().map(view),
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
