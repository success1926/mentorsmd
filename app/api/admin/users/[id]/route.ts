import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS } from "@/lib/validate";
import { hasAvailability } from "@/lib/schedule";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user && (session.user as any).role === "ADMIN";
}

const ACTIVE_STATUSES = ["IN_ESCROW", "COMPLETED"] as const;

// One person's details for the admin "View" panel.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, credential: true, bio: true, photoUrl: true, createdAt: true,
      profileStatus: true, pausedUntil: true, awayNote: true, removedAt: true, removedReason: true, removedByAdmin: true,
      mentorStage: true, schoolType: true, backgrounds: true, weeklyHours: true, timeZone: true, externalCalUrl: true,
      gigs: { where: { active: true }, select: { id: true, title: true, price: true, service: true, format: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where = user.role === "SELLER" ? { sellerId: user.id } : { buyerId: user.id };
  const [orders, reviews] = await Promise.all([
    prisma.order.findMany({
      where: { ...where, status: { not: "PENDING_PAYMENT" } },
      include: { gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    user.role === "SELLER"
      ? prisma.review.aggregate({ where: { sellerId: user.id }, _avg: { rating: true }, _count: { _all: true } })
      : Promise.resolve(null),
  ]);

  // The mentor's secret calendar address stays private, even from admins.
  const { weeklyHours, externalCalUrl, ...rest } = user;
  return NextResponse.json({
    user: { ...rest, hasAvailability: hasAvailability(weeklyHours), externalCalConnected: !!externalCalUrl },
    orders,
    rating: reviews ? { avg: reviews._avg.rating, count: reviews._count._all } : null,
  });
}

// Actions: pause | unpause (mentors), remove { reason } | restore (anyone
// but admins). Removing blocks sign-in and hides a mentor from the site.
// Open orders are NOT cancelled automatically - the response says how many
// there are, so the admin can refund or reassign them from each order.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "ADMIN") return NextResponse.json({ error: "Admin accounts can't be changed here" }, { status: 400 });

  const { action, reason } = await req.json().catch(() => ({}));
  let data: Record<string, any>;

  switch (action) {
    case "pause":
      if (user.role !== "SELLER") return NextResponse.json({ error: "Only mentors can be paused" }, { status: 400 });
      data = { profileStatus: "PAUSED", pausedUntil: null };
      break;
    case "unpause":
      data = { profileStatus: "ACTIVE", pausedUntil: null, awayNote: null };
      break;
    case "remove":
      if (typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "Add a reason - it's kept on record" }, { status: 400 });
      }
      if (reason.length > LIMITS.reason) return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
      data = { profileStatus: "REMOVED", removedAt: new Date(), removedReason: reason.trim(), removedByAdmin: true };
      break;
    case "restore":
      data = { profileStatus: "ACTIVE", removedAt: null, removedReason: null, removedByAdmin: false, pausedUntil: null, awayNote: null };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, profileStatus: true, removedAt: true, removedReason: true, removedByAdmin: true },
  });

  const activeOrders = await prisma.order.count({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      ...(user.role === "SELLER" ? { sellerId: user.id } : { buyerId: user.id }),
    },
  });

  return NextResponse.json({ user: updated, activeOrders });
}
