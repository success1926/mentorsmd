import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendInvite } from "@/lib/invites";
import { normalizeEmail } from "@/lib/validate";

// Admin actions on one application:
//   invite  - send the normal mentor invite to the applicant's email
//   decline - mark it declined (no email is sent)
//   reopen  - move a declined application back to Pending
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const adminId = (session.user as any).id as string;

  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const app = await prisma.mentorApplication.findUnique({ where: { id: params.id } });
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  if (action === "decline" || action === "reopen") {
    const status = action === "decline" ? "DECLINED" : "PENDING";
    const updated = await prisma.mentorApplication.update({
      where: { id: app.id },
      data: { status, decidedAt: action === "decline" ? new Date() : null },
    });
    return NextResponse.json({ application: updated });
  }

  if (action === "invite") {
    const email = normalizeEmail(app.email);
    if (!email) return NextResponse.json({ error: "This application's email isn't valid" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (existing) {
      return NextResponse.json({ error: `There's already an account with ${email}${existing.role === "SELLER" ? " (a mentor)" : ""}.` }, { status: 400 });
    }

    // Claim it first so a double-click can't send two invites.
    const claim = await prisma.mentorApplication.updateMany({
      where: { id: app.id, status: { not: "INVITED" } },
      data: { status: "INVITED", decidedAt: new Date() },
    });
    if (claim.count === 0) return NextResponse.json({ error: "This applicant was already invited" }, { status: 409 });

    let result;
    try {
      result = await createAndSendInvite(email, adminId);
    } catch (err) {
      console.error("Invite from application failed:", err);
      await prisma.mentorApplication.update({ where: { id: app.id }, data: { status: app.status, decidedAt: app.decidedAt } });
      return NextResponse.json({ error: "Couldn't create the invite. Try again." }, { status: 500 });
    }
    const updated = await prisma.mentorApplication.update({ where: { id: app.id }, data: { inviteId: result.invite.id } });
    return NextResponse.json({ application: updated, emailSent: result.emailSent, warning: "warning" in result ? result.warning : undefined });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
