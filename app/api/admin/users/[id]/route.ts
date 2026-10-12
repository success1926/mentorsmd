import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS } from "@/lib/validate";
import { hasAvailability } from "@/lib/schedule";
import { logAdminAction } from "@/lib/adminLog";
import { placeSafetyHold } from "@/lib/flags";
import { healthFor } from "@/lib/health";
import { describeFilters } from "@/lib/insights";

async function requireAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user && (session.user as any).role === "ADMIN" ? ((session.user as any).id as string) : null;
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
      safetyHoldAt: true, safetyHoldReason: true, lastActiveAt: true, emailVerified: true, mentorAgreementVersion: true, mentorAgreementAt: true, dateOfBirth: true, minorStatus: true, becameAdultAt: true, acceptsMinors: true,
      mentorStage: true, schoolType: true, backgrounds: true, medicalSchool: true, signupSource: true, signupDetail: true, weeklyHours: true, timeZone: true, externalCalUrl: true,
      gigs: { where: { active: true }, select: { id: true, title: true, price: true, service: true, format: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where = user.role === "SELLER" ? { sellerId: user.id } : { buyerId: user.id };
  const [orders, reviews, health, flags, actions, activity] = await Promise.all([
    prisma.order.findMany({
      where: { ...where, status: { not: "PENDING_PAYMENT" } },
      include: { gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    user.role === "SELLER"
      ? prisma.review.aggregate({ where: { sellerId: user.id }, _avg: { rating: true }, _count: { _all: true } })
      : Promise.resolve(null),
    healthFor(user.id, user.role),
    prisma.flag.findMany({
      where: { subjectUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, createdAt: true, kind: true, source: true, severity: true, status: true, reason: true, action: true, resolvedAt: true, resolutionNote: true },
    }),
    prisma.adminAction.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { admin: { select: { name: true } } },
    }),
    // Private activity log (#86): what this person did, or (mentors) who
    // looked at their profile recently.
    prisma.activityEvent.findMany({
      where: user.role === "SELLER" ? { OR: [{ userId: user.id }, { mentorId: user.id }] } : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, createdAt: true, kind: true, query: true, filters: true, resultCount: true, mentorId: true, path: true, user: { select: { name: true } } },
    }),
  ]);
  const viewedIds = Array.from(new Set(activity.map((a) => a.mentorId).filter(Boolean) as string[]));
  const viewedNames = new Map((await prisma.user.findMany({ where: { id: { in: viewedIds } }, select: { id: true, name: true } })).map((m) => [m.id, m.name]));

  // The mentor's secret calendar address stays private, even from admins.
  const { weeklyHours, externalCalUrl, ...rest } = user;
  return NextResponse.json({
    user: { ...rest, hasAvailability: hasAvailability(weeklyHours), externalCalConnected: !!externalCalUrl },
    orders,
    health,
    flags,
    actions,
    activity: activity.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      kind: a.kind,
      text:
        a.kind === "PROFILE_VIEW"
          ? a.mentorId === user.id
            ? `${a.user?.name || "A visitor"} viewed this profile`
            : `Viewed ${viewedNames.get(a.mentorId || "") || "a mentor"}'s profile`
          : a.kind === "SEARCH"
            ? `Searched ${[a.query ? `"${a.query}"` : "", describeFilters(a.filters)].filter(Boolean).join(" · ")} (${a.resultCount ?? "?"} found)`
            : a.kind === "VISIT"
              ? `Visited${a.path ? ` ${a.path}` : ""}`
              : "Signed up",
    })),
    rating: reviews ? { avg: reviews._avg.rating, count: reviews._count._all } : null,
  });
}

// Actions: pause | unpause (mentors), remove { reason } | restore (anyone
// but admins). Removing blocks sign-in and hides a mentor from the site.
// Open orders are NOT cancelled automatically - the response says how many
// there are, so the admin can refund or reassign them from each order.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "ADMIN") return NextResponse.json({ error: "Admin accounts can't be changed here" }, { status: 400 });

  const { action, reason } = await req.json().catch(() => ({}));
  let data: Record<string, any>;

  switch (action) {
    case "pause":
      // Paused pending review: mentors are hidden (and can't unpause
      // themselves), students can't send messages.
      await placeSafetyHold(user.id, typeof reason === "string" && reason.trim() ? reason.trim() : "Paused by an admin", adminId);
      data = {};
      break;
    case "unpause":
      data = {
        safetyHoldAt: null,
        safetyHoldReason: null,
        ...(user.role === "SELLER" && user.profileStatus === "PAUSED" ? { profileStatus: "ACTIVE", pausedUntil: null, awayNote: null } : {}),
      };
      break;
    case "remove":
      if (typeof reason !== "string" || !reason.trim()) {
        return NextResponse.json({ error: "Add a reason - it's kept on record" }, { status: 400 });
      }
      if (reason.length > LIMITS.reason) return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
      data = { profileStatus: "REMOVED", removedAt: new Date(), removedReason: reason.trim(), removedByAdmin: true };
      break;
    case "restore":
      data = { profileStatus: "ACTIVE", removedAt: null, removedReason: null, removedByAdmin: false, pausedUntil: null, awayNote: null, safetyHoldAt: null, safetyHoldReason: null };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const labels: Record<string, string> = { pause: "Paused", unpause: "Unpaused", remove: "Removed", restore: "Restored" };
  await logAdminAction({
    adminId,
    action: `USER_${String(action).toUpperCase()}`,
    summary: `${labels[action]} ${user.name} (${user.role === "SELLER" ? "mentor" : "student"})${action === "remove" ? `: ${String(reason).trim()}` : ""}`,
    targetType: "USER",
    targetId: user.id,
    targetUserId: user.id,
  });

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
