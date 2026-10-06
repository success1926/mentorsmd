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

  // Resending gives the link a fresh 7 days, so an expired invite can be revived.
  await prisma.invite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) } });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/become-a-mentor/join?code=${invite.code}&email=${encodeURIComponent(invite.email)}`;
  try {
    await sendSellerInviteEmail(invite.email, inviteUrl);
  } catch (err) {
    console.error("Failed to resend invite email:", err);
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `The email failed to send: ${reason}` }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
