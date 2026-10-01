import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One conversation per (buyer, seller) pair - reused across every gig they
// discuss, so message history doesn't get fragmented per package.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { sellerId } = await req.json();
  const role = (session.user as any).role;
  const userId = (session.user as any).id;

  if (role !== "BUYER") {
    return NextResponse.json({ error: "Only student accounts can start a conversation with a mentor" }, { status: 403 });
  }

  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller || seller.role !== "SELLER" || seller.profileStatus === "REMOVED") {
    return NextResponse.json({ error: "That mentor doesn't exist" }, { status: 404 });
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
