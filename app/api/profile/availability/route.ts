import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, parseDate } from "@/lib/validate";

// Mentor-only: pause, unpause, remove or restore their own profile.
//   pause   { pausedUntil?: date, awayNote?: string } - hidden from search; returns automatically on pausedUntil
//   unpause                                          - visible again now
//   remove  { reason?: string }                      - hidden entirely; open orders continue
//   restore                                          - undo a self-removal (not an admin removal)
// Existing orders are never affected - the mentor still finishes them.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  }
  const userId = (session.user as any).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (user.removedByAdmin) {
    return NextResponse.json({ error: "Your profile was removed by MentorsMD. Contact us to discuss it." }, { status: 403 });
  }

  let data: Record<string, any>;
  switch (action) {
    case "pause": {
      let pausedUntil: Date | null = null;
      if (body.pausedUntil) {
        pausedUntil = parseDate(body.pausedUntil);
        if (!pausedUntil || pausedUntil.getTime() < Date.now()) {
          return NextResponse.json({ error: "Pick a return date in the future (within a year)" }, { status: 400 });
        }
      }
      if (body.awayNote !== undefined && body.awayNote !== null && (typeof body.awayNote !== "string" || body.awayNote.length > LIMITS.awayNote)) {
        return NextResponse.json({ error: `Away note must be under ${LIMITS.awayNote} characters` }, { status: 400 });
      }
      data = { profileStatus: "PAUSED", pausedUntil, awayNote: (body.awayNote || "").trim() || null };
      break;
    }
    case "unpause":
      data = { profileStatus: "ACTIVE", pausedUntil: null, awayNote: null };
      break;
    case "remove": {
      if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > LIMITS.reason)) {
        return NextResponse.json({ error: "Reason is too long" }, { status: 400 });
      }
      data = { profileStatus: "REMOVED", removedAt: new Date(), removedReason: (body.reason || "").trim() || null, removedByAdmin: false };
      break;
    }
    case "restore":
      if (user.profileStatus !== "REMOVED") return NextResponse.json({ error: "Your profile isn't removed" }, { status: 400 });
      data = { profileStatus: "ACTIVE", removedAt: null, removedReason: null, pausedUntil: null, awayNote: null };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { profileStatus: true, pausedUntil: true, awayNote: true, removedAt: true },
  });

  const activeOrders = await prisma.order.count({ where: { sellerId: userId, status: { in: ["IN_ESCROW", "COMPLETED"] } } });
  return NextResponse.json({ availability: updated, activeOrders });
}
