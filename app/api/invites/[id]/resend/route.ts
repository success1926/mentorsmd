import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSellerInviteEmail } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "This invite has already been used or is no longer valid" }, { status: 400 });
  }

  const inviteUrl = `${process.env.NEXTAUTH_URL}/onboard-coach?code=${invite.code}&email=${encodeURIComponent(invite.email)}`;
  await sendSellerInviteEmail(invite.email, inviteUrl);

  return NextResponse.json({ success: true });
}
