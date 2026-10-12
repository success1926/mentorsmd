import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markRead } from "@/lib/unread";

// Marks a conversation read for the logged-in person. Called when a new
// message arrives while they already have the thread open.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const convo = await prisma.conversation.findUnique({ where: { id: params.id }, select: { id: true, buyerId: true, sellerId: true } });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  await markRead(convo, userId);
  return NextResponse.json({ ok: true });
}
