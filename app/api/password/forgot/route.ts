import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, SITE_URL } from "@/lib/email";
import { normalizeEmail } from "@/lib/validate";

const TOKEN_TTL_MINUTES = 60;
const MAX_REQUESTS_PER_HOUR = 3;

// Always answers the same way whether or not the email has an account,
// so this can't be used to find out who's signed up.
const GENERIC = { ok: true, message: "If an account exists for that email, a reset link is on its way." };

// Every answer takes at least this long, so response time doesn't reveal
// whether the email has an account (a real one waits on sending email).
const MIN_RESPONSE_MS = 1500;
async function respond(startedAt: number) {
  const wait = MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return NextResponse.json(GENERIC);
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) return respond(startedAt);

  // Limit how many reset emails one account can trigger, so nobody can
  // flood someone's inbox (or burn through your email quota).
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return respond(startedAt);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await prisma.passwordResetToken.create({
    data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000) },
  });

  try {
    await sendPasswordResetEmail(user.email, `${SITE_URL}/reset-password?token=${token}`);
  } catch (err) {
    console.error("Failed to send password reset email:", err);
  }

  return respond(startedAt);
}
