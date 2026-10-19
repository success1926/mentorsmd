import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookableGigWhere, isMentorListed } from "@/lib/mentor";
import { gateBlockReason } from "@/lib/gate";
import { isUnlocked } from "@/lib/unlock";

// PART 2 STUB (hourly redesign, docs/redesign-2026-10.md sections 4 and 6).
// The Buy buttons on a mentor's profile (Hourly, bundles, specialized
// packages) post here with { gigId }. The checks below are the real ones
// (student, offer on sale, mentor listed, unlocked, under-18 rule); the
// new order + MentorsMD credit + Stripe Checkout are built in part 2 of the
// redesign, so for now it answers 501 "coming in part 2".
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can buy" }, { status: 403 });
  }
  const studentId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));
  if (typeof body.gigId !== "string") return NextResponse.json({ error: "Package not found" }, { status: 404 });

  const gig = await prisma.gig.findFirst({ where: { id: body.gigId, ...bookableGigWhere }, include: { seller: true } });
  if (!gig) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (!isMentorListed(gig.seller)) return NextResponse.json({ error: "This mentor isn't taking new orders right now" }, { status: 400 });
  const gate = await gateBlockReason(studentId);
  if (gate) return NextResponse.json({ error: gate, code: "ACCOUNT_GATE" }, { status: 403 });
  if (!gig.seller.acceptsMinors) {
    const me = await prisma.user.findUnique({ where: { id: studentId }, select: { minorStatus: true } });
    if (me?.minorStatus) return NextResponse.json({ error: "This mentor works with students 18 and over." }, { status: 403 });
  }
  if (!(await isUnlocked(studentId, gig.sellerId))) {
    return NextResponse.json({ error: "Message or book an intro call to unlock", code: "LOCKED" }, { status: 403 });
  }

  return NextResponse.json(
    { error: "Checkout for hourly offers is coming in part 2 of the redesign.", code: "COMING_IN_PART_2" },
    { status: 501 }
  );
}
