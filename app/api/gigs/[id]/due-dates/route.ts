import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookableGigWhere } from "@/lib/mentor";
import { dueDateRules, todayFor } from "@/lib/dueDates";

export const dynamic = "force-dynamic";

// For the checkout date picker: the earliest allowed due date (from the
// package's turnaround) and the mentor's busy dates to grey out.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const gig = await prisma.gig.findFirst({ where: { id: params.id, ...bookableGigWhere }, select: { sellerId: true, turnaround: true } });
  if (!gig) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const today = await todayFor((session.user as any).id);
  return NextResponse.json(await dueDateRules(gig.sellerId, gig.turnaround, today));
}
