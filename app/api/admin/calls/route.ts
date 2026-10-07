import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyConfigured, recordingEnabled } from "@/lib/daily";

export const dynamic = "force-dynamic";

// Admin: recent and upcoming calls, with attendance and recordings.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const now = Date.now();
  const calls = await prisma.callBooking.findMany({
    where: { startTime: { gte: new Date(now - 60 * 24 * 3600_000), lte: new Date(now + 14 * 24 * 3600_000) } },
    include: {
      order: {
        select: {
          id: true, buyerId: true, sellerId: true, disputed: true, status: true,
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
  return NextResponse.json({
    calls,
    setup: {
      video: dailyConfigured(),
      recording: recordingEnabled(),
      webhookSecret: !!process.env.DAILY_WEBHOOK_SECRET,
    },
  });
}
