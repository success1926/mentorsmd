import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Both lists for the admin page: disputes still waiting on a decision,
// and recently resolved ones (refunded or released).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const include = {
    gig: { select: { id: true, title: true } },
    buyer: { select: { name: true, email: true } },
    seller: { select: { name: true, email: true } },
    // Everything the mentor delivered, so the admin can judge the work.
    deliveries: { orderBy: { number: "asc" as const } },
  };

  const [open, resolved] = await Promise.all([
    prisma.order.findMany({
      where: { disputed: true, status: { in: ["IN_ESCROW", "COMPLETED"] } },
      include,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { disputed: true, status: { in: ["RELEASED", "REFUNDED"] } },
      include,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  // `orders` kept for anything still reading the old shape.
  return NextResponse.json({ orders: open, open, resolved });
}
