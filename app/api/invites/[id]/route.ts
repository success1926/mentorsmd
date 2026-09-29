import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Cancel an invite. Deletes the row, so the emailed link stops working
// immediately (signup looks the code up and won't find it). The delete is
// conditional on the invite not being REDEEMED, so a coach who signs up at
// the same moment keeps their account and the redeemed record is kept.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const result = await prisma.invite.deleteMany({
    where: { id: params.id, status: { not: "REDEEMED" } },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "This invite was already redeemed or no longer exists" },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
