import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { prisma } from "@/lib/prisma";
import { sendSellerInviteEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/adminLog";
import { siteUrl } from "@/lib/siteUrl";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = await currentAdmin("mentors");
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const invite = await prisma.invite.findUnique({ where: { id: params.id } });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "This invite has already been used or is no longer valid" }, { status: 400 });
  }

  // Resending gives the link a fresh 7 days, so an expired invite can be revived.
  await prisma.invite.update({ where: { id: invite.id }, data: { expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) } });

  const inviteUrl = `${siteUrl()}/become-a-mentor/join?code=${invite.code}&email=${encodeURIComponent(invite.email)}`;
  try {
    await sendSellerInviteEmail(invite.email, inviteUrl);
  } catch (err) {
    console.error("Failed to resend invite email:", err);
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `The email failed to send: ${reason}` }, { status: 502 });
  }

  await logAdminAction({ adminId: admin.id, action: "INVITE_RESENT", summary: `Re-sent the mentor invite to ${invite.email}`, targetType: "INVITE", targetId: invite.id });
  return NextResponse.json({ success: true });
}
