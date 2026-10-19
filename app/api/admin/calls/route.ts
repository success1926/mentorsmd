import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { dailyConfigured, recordingEnabled } from "@/lib/daily";

export const dynamic = "force-dynamic";

// Admin: recent and upcoming calls, with attendance and recordings.
export async function GET() {
  const admin = await currentAdmin("calls");
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const now = Date.now();
  const calls = await prisma.callBooking.findMany({
    // Calls on packages, and free 15-minute intro calls (no order).
    where: { startTime: { gte: new Date(now - 60 * 24 * 3600_000), lte: new Date(now + 14 * 24 * 3600_000) } },
    include: {
      student: { select: { id: true, name: true } },
      mentor: { select: { id: true, name: true } },
      order: {
        select: {
          id: true, buyerId: true, sellerId: true, disputed: true, disputeResolvedAt: true, status: true, packageTitle: true,
          gig: { select: { title: true } },
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
        },
      },
      attendance: { orderBy: { joinedAt: "asc" }, select: { id: true, userId: true, name: true, joinedAt: true, leftAt: true, durationSec: true } },
      recordings: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, startedAt: true, durationSec: true, deletedAt: true } },
    },
    orderBy: { startTime: "desc" },
    take: 200,
  });
  // One shape for both kinds: who's on the call and what it's for. Intro
  // calls get a stand-in "order" with just the two people, so attendance
  // can say who's the student and who's the mentor.
  const rows = calls.map((c) => {
    const intro = c.kind === "INTRO" || !c.order;
    return {
      ...c,
      intro,
      label: intro ? "Free intro call" : c.order!.packageTitle || c.order!.gig.title,
      studentName: c.order?.buyer.name ?? c.student?.name ?? "Student",
      mentorName: c.order?.seller.name ?? c.mentor?.name ?? "Mentor",
      disputeOpen: !!c.order?.disputed && !c.order?.disputeResolvedAt,
      order: c.order ?? { id: null, buyerId: c.studentId, sellerId: c.mentorId },
    };
  });
  return NextResponse.json({
    calls: rows,
    setup: {
      video: dailyConfigured(),
      recording: recordingEnabled(),
      webhookSecret: !!process.env.DAILY_WEBHOOK_SECRET,
    },
  });
}
