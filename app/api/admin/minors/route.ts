import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAdmin } from "@/lib/adminTeam";
import { resendParentConsent } from "@/lib/minors";
import { logAdminAction } from "@/lib/adminLog";

export const dynamic = "force-dynamic";

// Admin -> Under 18 (#113): students aged 13-17 (and those who have
// turned 18), with every parent consent request and its signature record.
export async function GET() {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { OR: [{ minorStatus: { not: null } }, { becameAdultAt: { not: null } }, { parentConsents: { some: {} } }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, name: true, email: true, createdAt: true, dateOfBirth: true, minorStatus: true, becameAdultAt: true, profileStatus: true,
      _count: { select: { buyerOrders: { where: { status: { not: "PENDING_PAYMENT" } } } } },
      parentConsents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, createdAt: true, status: true, parentName: true, parentEmail: true, parentPhone: true, expiresAt: true, lastSentAt: true,
          remindersSent: true, consentedAt: true, signatureName: true, ip: true, userAgent: true, termsVersion: true, consentFormVersion: true, withdrawnAt: true,
        },
      },
    },
  });
  return NextResponse.json({ users });
}

// { action: "resend", userId }: email the parent a fresh consent link.
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "resend" || typeof body.userId !== "string") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, name: true, email: true, minorStatus: true } });
  if (!user?.minorStatus || user.minorStatus === "CONSENTED") return NextResponse.json({ error: "This student doesn't need a consent request" }, { status: 400 });
  const r = await resendParentConsent(user);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  await logAdminAction({ adminId: admin.id, action: "MINOR_CONSENT_RESENT", summary: `Re-sent the parent consent link for ${user.name}`, targetType: "USER", targetId: user.id, targetUserId: user.id });
  return NextResponse.json({ ok: true, emailSent: r.emailSent });
}
