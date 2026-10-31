import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { deleteAccount, deletionCheck } from "@/lib/accountDeletion";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// "Delete my account" in Settings and in the phone app (lib/accountDeletion.ts).
//   GET  -> { allowed, blockers, creditCents, hasPassword }
//   POST { confirm: "DELETE", password? } -> { ok: true }
// An account with a password must type it again, so someone using a
// browser left logged in can't delete it. Only for someone fully logged in
// (not halfway through 2-step).
async function me() {
  const session = await getSession();
  const u = session?.user as any;
  if (!u?.id || !["ADMIN", "SELLER", "BUYER"].includes(u.role)) return null;
  return u.id as string;
}

export async function GET() {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const check = await deletionCheck(userId);
  if (!check) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(check);
}

export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (String(body.confirm || "").trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const check = await deletionCheck(userId);
  if (!check) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!check.allowed) return NextResponse.json({ error: check.blockers[0], blockers: check.blockers }, { status: 409 });

  if (check.hasPassword) {
    const r = await rateLimit(RATE_LIMITS.loginFailPerAccountIp, `delete:${userId}`);
    if (!r.ok) return tooMany(r.retryAfterSec, "Too many wrong passwords. Please wait 15 minutes and try again.");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    const ok = typeof body.password === "string" && !!user?.passwordHash && (await bcrypt.compare(body.password.slice(0, 500), user.passwordHash));
    if (!ok) return NextResponse.json({ error: "That password isn't right." }, { status: 400 });
  }

  try {
    await deleteAccount(userId);
  } catch (err) {
    console.error("Couldn't delete an account:", err);
    return NextResponse.json({ error: "That didn't work, and nothing was deleted. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
