import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";

// Both lists for the admin page: disputes still waiting on a decision,
// and recently resolved ones (refunded or released).
export async function GET() {
  const admin = await currentAdmin("disputes");
  if (!admin) {
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
