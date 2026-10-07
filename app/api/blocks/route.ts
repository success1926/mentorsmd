import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockBetween } from "@/lib/blocks";

// Block / unblock someone. Blocked people can't message each other.
//   GET    ?userId=  -> { iBlocked, theyBlocked }
//   POST   { userId } -> block
//   DELETE ?userId=  -> unblock
async function me() {
  const session = await getServerSession(authOptions);
  return session?.user ? ((session.user as any).id as string) : null;
}

export async function GET(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const other = new URL(req.url).searchParams.get("userId");
  if (!other) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  return NextResponse.json(await blockBetween(userId, other));
}

export async function POST(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { userId: other } = await req.json().catch(() => ({}));
  if (typeof other !== "string" || other === userId) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  const target = await prisma.user.findUnique({ where: { id: other }, select: { role: true } });
  if (!target) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  if (target.role === "ADMIN") return NextResponse.json({ error: "MentorsMD staff can't be blocked" }, { status: 400 });
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: other } },
    update: {},
    create: { blockerId: userId, blockedId: other },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await me();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const other = new URL(req.url).searchParams.get("userId");
  if (!other) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: other } });
  return NextResponse.json({ ok: true });
}
