import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockBetween } from "@/lib/blocks";
import { requireUser } from "@/lib/session";

// Block / unblock someone. Blocked people can't message each other.
//   GET    ?userId=  -> { iBlocked, theyBlocked }
//   POST   { userId } -> block
//   DELETE ?userId=  -> unblock

export async function GET(req: Request) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;
  const other = new URL(req.url).searchParams.get("userId");
  if (!other) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  return NextResponse.json(await blockBetween(userId, other));
}

export async function POST(req: Request) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;
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
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;
  const other = new URL(req.url).searchParams.get("userId");
  if (!other) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: other } });
  return NextResponse.json({ ok: true });
}
