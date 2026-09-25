import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { isValidNewPassword, PASSWORD_RULE } from "@/lib/validate";

// Second half of "forgot password": the link from the email lands on
// /reset-password, which posts the token and the new password here.
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "This reset link isn't valid. Request a new one." }, { status: 400 });
  }
  if (!isValidNewPassword(password)) return NextResponse.json({ error: PASSWORD_RULE }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Claim the token atomically: only one request can ever use a link,
  // even if it's clicked twice at the same moment.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { userId: true } });
  if (!record) return NextResponse.json({ error: "This reset link isn't valid. Request a new one." }, { status: 400 });

  // Hashed only once the link is confirmed valid, so random guesses
  // can't make the server do expensive work.
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // Also clears any login lockout from earlier failed attempts.
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
    }),
    // Any other outstanding reset links for this account stop working.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
