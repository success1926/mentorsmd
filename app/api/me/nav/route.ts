import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unreadFor } from "@/lib/unread";
import { isMentorListed, isMentorVisible } from "@/lib/mentor";
import { profileFieldsSelect, profileProgress } from "@/lib/profileCompleteness";
import { creditBalance } from "@/lib/credit";

export const dynamic = "force-dynamic";

// Small status the top bar and the mentor sidebar poll: unread messages,
// and for mentors how many offers they have (to show "Set your rate" vs
// "Rate & offers"), active packages, profile progress and whether they're
// live on Browse. For students (student area v2): active packages, how many
// wait on their answer, upcoming calls and their MentorsMD credit.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ unread: 0, unreadConversations: 0, packageCount: null, mentor: null, student: null });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;
  const isMentor = role === "SELLER";

  const [unread, packageCount, activePackages, me] = await Promise.all([
    unreadFor(userId, role),
    // Offers since the redesign (the Hourly offer exists once a rate is set).
    isMentor ? prisma.gig.count({ where: { sellerId: userId, active: true, kind: { not: null } } }) : Promise.resolve(null),
    // Active hours packages: paid, not yet approved (working, waiting on the student, or disputed).
    isMentor ? prisma.order.count({ where: { sellerId: userId, kind: { not: null }, status: "IN_ESCROW", approvedAt: null } }) : Promise.resolve(0),
    isMentor
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { ...profileFieldsSelect, id: true, name: true, profileStatus: true, pausedUntil: true, safetyHoldAt: true, profileCompleteAt: true },
        })
      : Promise.resolve(null),
  ]);

  let mentor = null;
  if (me) {
    const progress = profileProgress(me);
    mentor = {
      id: me.id,
      name: me.name,
      photoUrl: me.photoUrl,
      activePackages,
      progress: { done: progress.done, total: progress.total, complete: progress.complete, missing: progress.sections.filter((s) => !s.done).map((s) => s.label) },
      listed: isMentorListed(me),
      paused: me.profileStatus === "PAUSED" && !isMentorVisible(me),
      removed: me.profileStatus === "REMOVED",
      safetyHold: !!me.safetyHoldAt,
    };
  }
  const student = role === "BUYER" ? await studentStatus(userId, session.user.name || "") : null;
  return NextResponse.json({ unread: unread.messages, unreadConversations: unread.conversations, packageCount, mentor, student });
}

async function studentStatus(userId: string, name: string) {
  const now = new Date();
  const [me, activePackages, waiting, upcomingCalls, creditCents] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, photoUrl: true } }),
    // Active hours packages: paid, not yet approved (working, waiting on the student, or disputed).
    prisma.order.count({ where: { buyerId: userId, kind: { not: null }, status: "IN_ESCROW", approvedAt: null } }),
    // Marked complete, the 48 hours still running.
    prisma.order.count({ where: { buyerId: userId, kind: { not: null }, status: "IN_ESCROW", approvedAt: null, disputed: false, markedCompleteAt: { not: null }, responseDeadline: { gt: now } } }),
    prisma.callBooking.count({
      where: {
        status: "BOOKED",
        endTime: { gt: now },
        OR: [{ order: { buyerId: userId, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } } }, { kind: "INTRO", studentId: userId }],
      },
    }),
    creditBalance(userId),
  ]);
  return { name: me?.name || name, photoUrl: me?.photoUrl || null, activePackages, waiting, upcomingCalls, creditCents };
}
