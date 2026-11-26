import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markRead } from "@/lib/unread";
import { requireUser } from "@/lib/session";

// Marks a conversation read for the logged-in person. Called when a new
// message arrives while they already have the thread open.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;

  const convo = await prisma.conversation.findUnique({ where: { id: params.id }, select: { id: true, buyerId: true, sellerId: true } });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  await markRead(convo, userId);
  return NextResponse.json({ ok: true });
}
