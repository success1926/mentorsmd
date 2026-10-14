import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";

// Cancel an invite. Deletes the row, so the emailed link stops working
// immediately (signup looks the code up and won't find it). The delete is
// conditional on the invite not being REDEEMED, so a coach who signs up at
// the same moment keeps their account and the redeemed record is kept.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("mentors");
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const before = await prisma.invite.findUnique({ where: { id: params.id }, select: { email: true } });
  const result = await prisma.invite.deleteMany({
    where: { id: params.id, status: { not: "REDEEMED" } },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "This invite was already redeemed or no longer exists" },
      { status: 400 }
    );
  }

  await logAdminAction({ adminId: admin.id, action: "INVITE_CANCELLED", summary: `Cancelled the mentor invite for ${before?.email || "an applicant"}`, targetType: "INVITE", targetId: params.id });
  return NextResponse.json({ success: true });
}
