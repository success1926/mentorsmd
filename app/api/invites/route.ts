import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSellerInviteEmail } from "@/lib/email";

// This is the whole access-control mechanism for who can become a seller:
// only an authenticated ADMIN can call this route to mint a code. There is
// no other path in the codebase that creates a SELLER-role user without
// one of these codes being redeemed first (see /api/signup/seller).
//
// The admin never has to copy/paste anything: this route emails the
// seller a one-click link with the code already embedded in the URL, so
// they just click through and land on a pre-filled signup form.

function requireAdmin(session: any) {
  return session?.user && (session.user as any).role === "ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const invite = await prisma.invite.create({
    data: {
      code,
      email,
      expiresAt,
      createdById: (session!.user as any).id,
    },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/onboard-coach?code=${code}&email=${encodeURIComponent(email)}`;

  try {
    await sendSellerInviteEmail(email, inviteUrl);
  } catch (err) {
    // The invite still exists even if the email failed to send - the
    // admin can resend it (see the /resend route below) rather than
    // losing the whole invite over a transient email error.
    return NextResponse.json({ invite, emailSent: false, warning: "Invite created but the email failed to send" });
  }

  return NextResponse.json({ invite, emailSent: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!requireAdmin(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ invites });
}
