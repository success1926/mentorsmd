import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockBetween } from "@/lib/blocks";

// New accounts (under NEW_ACCOUNT_DAYS old) can start at most
// NEW_ACCOUNT_DAILY_CONVERSATIONS new conversations with mentors a day.
// Slows down spam accounts without getting in real students' way.
const NEW_ACCOUNT_DAYS = 7;
const NEW_ACCOUNT_DAILY_CONVERSATIONS = 5;

// One conversation per (buyer, seller) pair - reused across every gig they
// discuss, so message history doesn't get fragmented per package.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { sellerId } = await req.json().catch(() => ({}));
  if (typeof sellerId !== "string") return NextResponse.json({ error: "That mentor doesn't exist" }, { status: 404 });
  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  if (role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can start a conversation with a mentor" }, { status: 403 });
  }

  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller || seller.role !== "SELLER" || seller.profileStatus === "REMOVED") {
    return NextResponse.json({ error: "That mentor doesn't exist" }, { status: 404 });
  }

  const existing = await prisma.conversation.findUnique({ where: { buyerId_sellerId: { buyerId: userId, sellerId } } });
  if (existing) return NextResponse.json({ conversation: existing });

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, safetyHoldAt: true } });
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.safetyHoldAt) {
    return NextResponse.json({ error: "Your account is paused while our team reviews it, so you can't start new conversations right now." }, { status: 403 });
  }
  const blocks = await blockBetween(userId, sellerId);
  if (blocks.iBlocked || blocks.theyBlocked) {
    return NextResponse.json({ error: blocks.iBlocked ? "You blocked this mentor. Unblock them from their profile to message them." : "You can't message this mentor." }, { status: 403 });
  }
  if (Date.now() - me.createdAt.getTime() < NEW_ACCOUNT_DAYS * 86400_000) {
    const today = await prisma.conversation.count({ where: { buyerId: userId, createdAt: { gte: new Date(Date.now() - 86400_000) } } });
    if (today >= NEW_ACCOUNT_DAILY_CONVERSATIONS) {
      return NextResponse.json(
        { error: `New accounts can message up to ${NEW_ACCOUNT_DAILY_CONVERSATIONS} new mentors a day. Please continue your current conversations, or try again tomorrow.` },
        { status: 429 }
      );
    }
  }

  const conversation = await prisma.conversation.upsert({
    where: { buyerId_sellerId: { buyerId: userId, sellerId } },
    update: {},
    create: { buyerId: userId, sellerId },
  });

  return NextResponse.json({ conversation });
}

// Lists the current user's conversations (works for both buyers and sellers).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const conversations = await prisma.conversation.findMany({
    where: role === "SELLER" ? { sellerId: userId } : { buyerId: userId },
    include: {
      buyer: { select: { id: true, name: true, photoUrl: true } },
      seller: { select: { id: true, name: true, credential: true, photoUrl: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Most recent activity first (a conversation's own createdAt never
  // changes, so sort by its latest message instead).
  const last = (c: (typeof conversations)[number]) => (c.messages[0]?.createdAt ?? c.createdAt).getTime();
  conversations.sort((a, b) => last(b) - last(a));

  return NextResponse.json({ conversations });
}
