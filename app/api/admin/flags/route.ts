import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin -> Flags: one queue for reports, disputes and automatic flags.
//   ?view=open (default)  open flags, most severe first, then newest
//   ?view=closed          the last 150 handled flags
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const closed = new URL(req.url).searchParams.get("view") === "closed";

  const flags = await prisma.flag.findMany({
    where: closed ? { status: { not: "OPEN" } } : { status: "OPEN" },
    orderBy: closed ? [{ resolvedAt: "desc" }] : [{ severity: "desc" }, { createdAt: "desc" }],
    take: closed ? 150 : 300,
    include: {
      subject: { select: { id: true, name: true, email: true, role: true, profileStatus: true, safetyHoldAt: true, removedByAdmin: true } },
      reporter: { select: { id: true, name: true, role: true } },
      resolvedBy: { select: { name: true } },
    },
  });

  // Order details for disputes and delivery flags.
  const orderIds = Array.from(new Set(flags.map((f) => f.orderId).filter((id): id is string => !!id)));
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true, disputed: true, amount: true, gig: { select: { title: true } } },
      })
    : [];
  const byOrder = new Map(orders.map((o) => [o.id, o]));

  const [openCount, highCount] = await Promise.all([
    prisma.flag.count({ where: { status: "OPEN" } }),
    prisma.flag.count({ where: { status: "OPEN", severity: { gte: 3 } } }),
  ]);

  return NextResponse.json({
    flags: flags.map((f) => ({ ...f, order: f.orderId ? byOrder.get(f.orderId) ?? null : null })),
    counts: { open: openCount, high: highCount },
  });
}
