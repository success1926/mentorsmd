import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Admin -> Orders & payouts -> Gifts and parent purchases (lib/gifts.ts):
// every gift a parent started, newest first. Paid package gifts are also
// normal orders (refunds as credit from Disputes, like any order); gifted
// credit is in the student's credit history (Admin -> People).
export async function GET() {
  const admin = await currentAdmin("orders");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const gifts = await prisma.gift.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, createdAt: true, kind: true, status: true, amountCents: true, parentName: true, parentEmail: true, studentName: true, studentEmail: true,
      studentUnder18: true, packageTitle: true, mentorId: true, studentId: true, orderId: true, paidAt: true, reviewNote: true, claimedAt: true, claimTokenHash: true,
    },
  });
  const ids = Array.from(new Set(gifts.flatMap((g) => [g.mentorId, g.studentId]).filter(Boolean) as string[]));
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, passwordHash: true, _count: { select: { accounts: true } } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return NextResponse.json({
    gifts: gifts.map(({ claimTokenHash, ...g }) => {
      const student = g.studentId ? byId.get(g.studentId) : null;
      return {
        ...g,
        mentorName: g.mentorId ? byId.get(g.mentorId)?.name ?? null : null,
        // Can the student log in yet (password or Google)?
        accountReady: !!student && (!!student.passwordHash || student._count.accounts > 0),
        claimLinkOpen: !!claimTokenHash,
      };
    }),
  });
}
