import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUSY_KINDS, dueDayOf, isValidBusyRange } from "@/lib/schedule";
import { fmtDayLabel } from "@/lib/tz";
import { SITE_URL, sendBusyClashEmail } from "@/lib/email";

// Mentor-only: busy dates (exams, rotations, travel). The note is private
// to the mentor. "No deadlines" stops students picking a due date in the
// range; "No deadlines and no calls" also blocks call slots.
async function requireMentor() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") return null;
  return session.user as any;
}

async function list(userId: string) {
  const today = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
  return prisma.busyDate.findMany({ where: { userId, endDay: { gte: today } }, orderBy: { startDay: "asc" }, take: 200 });
}

// Active orders whose due date (or booked call) falls inside the range.
async function clashes(userId: string, startDay: string, endDay: string, blocksCalls: boolean) {
  const from = new Date(`${startDay}T00:00:00.000Z`);
  const to = new Date(`${endDay}T23:59:59.999Z`);
  const [orders, calls] = await Promise.all([
    prisma.order.findMany({
      where: { sellerId: userId, status: "IN_ESCROW", dueDate: { gte: from, lte: to } },
      select: { id: true, dueDate: true, gig: { select: { title: true } }, buyer: { select: { name: true } } },
      take: 50,
    }),
    blocksCalls
      ? prisma.callBooking.findMany({
          where: { status: "BOOKED", startTime: { gte: from, lte: to }, order: { sellerId: userId, status: { in: ["IN_ESCROW", "COMPLETED"] } } },
          select: { id: true, startTime: true, orderId: true, order: { select: { gig: { select: { title: true } }, buyer: { select: { name: true } } } } },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  return {
    deadlines: orders.map((o) => ({ orderId: o.id, gigTitle: o.gig.title, studentName: o.buyer.name, dueDay: dueDayOf(o.dueDate!) })),
    calls: calls.map((c) => ({ orderId: c.orderId, gigTitle: c.order.gig.title, studentName: c.order.buyer.name, startTime: c.startTime })),
  };
}

export async function GET() {
  const user = await requireMentor();
  if (!user) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  return NextResponse.json({ busyDates: await list(user.id) });
}

// Body: { startDay, endDay, kind, note }
export async function POST(req: Request) {
  const user = await requireMentor();
  if (!user) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!isValidBusyRange(body.startDay, body.endDay)) {
    return NextResponse.json({ error: "Pick a start date and an end date on or after it" }, { status: 400 });
  }
  const today = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
  if (body.endDay < today) return NextResponse.json({ error: "Those dates are in the past" }, { status: 400 });
  if (!BUSY_KINDS.some((k) => k.value === body.kind)) return NextResponse.json({ error: "Choose what the dates block" }, { status: 400 });
  if (body.note !== undefined && body.note !== null && (typeof body.note !== "string" || body.note.length > 200)) {
    return NextResponse.json({ error: "Keep the note under 200 characters" }, { status: 400 });
  }
  const count = await prisma.busyDate.count({ where: { userId: user.id, endDay: { gte: today } } });
  if (count >= 100) return NextResponse.json({ error: "You have a lot of busy dates already. Remove some old ones first." }, { status: 400 });

  const created = await prisma.busyDate.create({
    data: { userId: user.id, startDay: body.startDay, endDay: body.endDay, kind: body.kind, note: (body.note || "").trim() || null },
  });

  // Existing orders keep their due dates; the mentor is warned instead.
  const clash = await clashes(user.id, created.startDay, created.endDay, created.kind === "NO_DEADLINES_NO_CALLS");
  if (clash.deadlines.length && user.email) {
    await sendBusyClashEmail(
      user.email,
      clash.deadlines.map((d) => ({ gigTitle: d.gigTitle, studentName: d.studentName, due: fmtDayLabel(d.dueDay), url: `${SITE_URL}/orders/${d.orderId}` }))
    ).catch((e) => console.error("busy clash email", e));
  }
  return NextResponse.json({ busyDate: created, busyDates: await list(user.id), clashes: clash });
}

// Body: { id }
export async function DELETE(req: Request) {
  const user = await requireMentor();
  if (!user) return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return NextResponse.json({ error: "Missing busy date" }, { status: 400 });
  await prisma.busyDate.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ busyDates: await list(user.id) });
}
