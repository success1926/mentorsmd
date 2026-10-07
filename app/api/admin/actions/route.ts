import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvBody, csvResponse } from "@/lib/csv";

// Admin -> Action log. Newest first; ?before=<ISO date> pages back.
// ?format=csv downloads the whole log (#84), up to 50,000 rows.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const sp = new URL(req.url).searchParams;
  if (sp.get("format") === "csv") {
    const all = await prisma.adminAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50_000,
      include: { admin: { select: { name: true } }, targetUser: { select: { name: true } } },
    });
    return csvResponse(
      `mentorsmd-admin-actions-${new Date().toISOString().slice(0, 10)}.csv`,
      csvBody(
        ["When (UTC)", "Admin", "Action", "Summary", "About", "Target type", "Target id"],
        all.map((a) => [a.createdAt, a.admin?.name || "System", a.action, a.summary, a.targetUser?.name || "", a.targetType || "", a.targetId || ""])
      )
    );
  }
  const before = sp.get("before");
  const beforeDate = before ? new Date(before) : null;
  const take = 100;
  const actions = await prisma.adminAction.findMany({
    where: beforeDate && !isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {},
    orderBy: { createdAt: "desc" },
    take,
    include: { admin: { select: { name: true } }, targetUser: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json({ actions, hasMore: actions.length === take });
}
