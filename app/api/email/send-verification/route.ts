import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationLink } from "@/lib/emailVerification";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

// "Resend the confirmation email" for the logged-in person.
export async function POST() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id as string;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, emailVerified: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyConfirmed: true });

  const limit = await rateLimit(RATE_LIMITS.verifyEmailPerHour, userId);
  if (!limit.ok) return tooMany(limit.retryAfterSec, "We've sent several links already. Check your spam folder, or try again in an hour.");
  try {
    await sendVerificationLink(user);
  } catch (err) {
    console.error("Couldn't send the confirm-your-email link:", err);
    return NextResponse.json({ error: "We couldn't send the email. Please try again in a few minutes." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
