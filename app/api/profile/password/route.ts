import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidNewPassword, PASSWORD_RULE } from "@/lib/validate";

// Change password while logged in. Requires the current password, so
// someone who walks up to an unlocked laptop can't lock the owner out.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!isValidNewPassword(newPassword)) return NextResponse.json({ error: PASSWORD_RULE }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "This account signs in with Google, so it doesn't have a password here." }, { status: 400 });
  }
  if (typeof currentPassword !== "string" || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password isn't right" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    // passwordChangedAt ends every other logged-in session (within a few
    // minutes); the browser that made the change signs in again right away.
    data: { passwordHash: await bcrypt.hash(newPassword, 12), failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
