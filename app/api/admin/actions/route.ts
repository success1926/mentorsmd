import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin -> Action log. Newest first; ?before=<ISO date> pages back.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const before = new URL(req.url).searchParams.get("before");
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
