import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { CYCLE_RESULTS_ON } from "@/lib/cycleResults";

export const dynamic = "force-dynamic";

// Admin -> Cycle results (read-only): every student's results, with the
// mentors they said helped. Refused while NEXT_PUBLIC_CYCLE_RESULTS isn't 1.
export async function GET() {
  if (!CYCLE_RESULTS_ON) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const admin = await currentAdmin("people");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const rows = await prisma.cycleResult.findMany({ orderBy: [{ cycle: "desc" }, { updatedAt: "desc" }], take: 2000 });
  const ids = Array.from(new Set(rows.flatMap((r) => [r.userId, ...r.mentorIds])));
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return NextResponse.json({
    results: rows.map((r) => ({
      ...r,
      studentName: byId.get(r.userId)?.name ?? "(deleted account)",
      studentEmail: byId.get(r.userId)?.email ?? "",
      mentors: r.mentorIds.map((id) => byId.get(id)?.name).filter(Boolean),
    })),
  });
}
