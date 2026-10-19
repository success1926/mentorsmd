// "Book a call" with a mentor from Messages, My packages and the dashboard
// (redesign Oct 2026, docs/redesign-2026-10.md section 4): the student's
// packages with this mentor that have hours left, or a pay-per-call at the
// mentor's hourly rate when none do. Server only.
import { prisma } from "@/lib/prisma";
import { hoursSummary } from "@/lib/hours";
import { finishPhase } from "@/lib/finishing";
import { priceFor } from "@/lib/pricing";
import { isMentorListed } from "@/lib/mentor";
import { isUnlocked } from "@/lib/unlock";

// The student's active hours packages with this mentor, with minutes left.
export async function bookablePackages(studentId: string, mentorId: string) {
  const orders = await prisma.order.findMany({
    where: { buyerId: studentId, sellerId: mentorId, kind: { not: null }, status: "IN_ESCROW", disputed: false },
    include: { gig: { select: { title: true } }, hourEntries: true, callBookings: true },
    orderBy: { createdAt: "asc" },
  });
  return orders
    .filter((o) => finishPhase(o) === "WORKING")
    .map((o) => ({ id: o.id, title: o.packageTitle || o.gig.title, left: hoursSummary(o).left, kind: o.kind }));
}

// Can the student pay for a single call with this mentor right now?
export async function payPerCallOffer(studentId: string, mentorId: string) {
  const mentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { role: true, hourlyRateCents: true, stripeAccountId: true, profileStatus: true, pausedUntil: true, safetyHoldAt: true, profileCompleteAt: true } });
  if (!mentor || mentor.role !== "SELLER" || !mentor.hourlyRateCents) return null;
  const available = isMentorListed(mentor) && !!mentor.stripeAccountId && (await isUnlocked(studentId, mentorId));
  return { available, rateCents: mentor.hourlyRateCents, price30: priceFor(30, mentor.hourlyRateCents), price60: priceFor(60, mentor.hourlyRateCents) };
}
