import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookableGigWhere } from "@/lib/mentor";
import { dueDateRules, todayFor } from "@/lib/dueDates";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// For the checkout date picker: the earliest allowed due date (from the
// package's turnaround) and the mentor's busy dates to grey out.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const gig = await prisma.gig.findFirst({ where: { id: params.id, ...bookableGigWhere }, select: { sellerId: true, turnaround: true } });
  if (!gig) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  const today = await todayFor((session.user as any).id);
  return NextResponse.json(await dueDateRules(gig.sellerId, gig.turnaround, today));
}
