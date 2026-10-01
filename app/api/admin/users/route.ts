import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin "People" list: mentors or students, with search.
//   ?role=SELLER|BUYER  (default SELLER)
//   ?q=text             name or email contains
//   ?status=ACTIVE|PAUSED|REMOVED  (optional)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const role = sp.get("role") === "BUYER" ? "BUYER" : "SELLER";
  const q = (sp.get("q") || "").trim().slice(0, 100);
  const status = sp.get("status");

  const users = await prisma.user.findMany({
    where: {
      role,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
      ...(status === "ACTIVE" || status === "PAUSED" || status === "REMOVED" ? { profileStatus: status } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      credential: true,
      photoUrl: true,
      createdAt: true,
      profileStatus: true,
      pausedUntil: true,
      removedAt: true,
      removedReason: true,
      removedByAdmin: true,
      stripeAccountId: true,
      _count: { select: { gigs: { where: { active: true } }, buyerOrders: true, sellerOrders: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const [mentors, students] = await Promise.all([
    prisma.user.count({ where: { role: "SELLER" } }),
    prisma.user.count({ where: { role: "BUYER" } }),
  ]);

  return NextResponse.json({
    users: users.map(({ stripeAccountId, ...u }) => ({ ...u, payoutsConnected: !!stripeAccountId })),
    counts: { mentors, students },
  });
}
