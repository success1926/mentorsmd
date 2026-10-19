import { NextResponse } from "next/server";
import { adminCan } from "@/lib/adminTeam";
import { ORDER_VIEW_PERMISSIONS } from "@/lib/adminPermissions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAvailability } from "@/lib/schedule";

// A single order, for the order detail page. Previously that page fetched
// EVERY order the user had and searched for one client-side, which also
// meant admins (who aren't the buyer or seller) couldn't open a disputed
// order at all.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      gig: true,
      buyer: { select: { id: true, name: true, photoUrl: true, minorStatus: true } },
      seller: { select: { id: true, name: true, credential: true, photoUrl: true, weeklyHours: true, hourlyRateCents: true } },
      review: true,
      callBookings: {
        orderBy: { startTime: "asc" },
        include: {
          attendance: { orderBy: { joinedAt: "asc" }, select: { id: true, userId: true, name: true, joinedAt: true, leftAt: true, durationSec: true } },
          // Recordings are admin-only; removed below for everyone else.
          recordings: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, startedAt: true, durationSec: true, deletedAt: true } },
        },
      },
      deliveries: { orderBy: { number: "asc" } },
      // Hours packages (redesign Oct 2026).
      hourEntries: { orderBy: [{ workDate: "desc" }, { createdAt: "desc" }], include: { loggedBy: { select: { name: true } } } },
      topUps: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, select: { id: true, minutes: true, amountCents: true, creditAppliedCents: true, paidAt: true } },
    },
  });

  // Admins can open any order if their role covers an area that links to
  // orders (lib/adminPermissions.ts); recordings need Calls or Disputes.
  const isAdmin = role === "ADMIN" && (await adminCan(ORDER_VIEW_PERMISSIONS));
  if (!order || (order.buyerId !== userId && order.sellerId !== userId && !isAdmin)) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Mentors can watch recordings of their own calls on hours packages
  // (their package workspace); students never see them.
  const showRecordings = (!!order.kind && order.sellerId === userId) || (isAdmin && (await adminCan(["calls", "disputes"])));
  // The package's shared files: attachments on its own messages.
  const files = order.kind
    ? await prisma.message.findMany({
        where: { orderId: order.id, attachmentUrl: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, attachmentName: true, createdAt: true, senderId: true },
        take: 200,
      })
    : [];
  const callsRecorded = order.callBookings.filter((b) => b.recordings.some((r) => r.status === "ready" || r.deletedAt)).length;
  const { weeklyHours, ...seller } = order.seller;
  const safe = {
    ...order,
    seller: { ...seller, hasAvailability: hasAvailability(weeklyHours) },
    callBookings: order.callBookings.map(({ recordings, ...b }) => ({ ...b, ...(showRecordings ? { recordings } : {}) })),
    files,
    callsRecorded,
  };
  return NextResponse.json({
    order: safe,
    viewer: { id: userId, role, name: session.user.name ?? "", email: session.user.email ?? "" },
  });
}
