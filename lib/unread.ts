import { prisma } from "@/lib/prisma";

// Unread messages are tracked as a count per side of each conversation
// (Conversation.buyerUnread / sellerUnread). Sending adds one to the other
// person's count; opening the conversation resets your own.

export async function markRead(convo: { id: string; buyerId: string; sellerId: string }, userId: string) {
  if (userId === convo.buyerId) {
    await prisma.conversation.updateMany({ where: { id: convo.id, buyerUnread: { gt: 0 } }, data: { buyerUnread: 0 } });
  } else if (userId === convo.sellerId) {
    await prisma.conversation.updateMany({ where: { id: convo.id, sellerUnread: { gt: 0 } }, data: { sellerUnread: 0 } });
  }
}

// Total unread messages and number of conversations with unread messages.
export async function unreadFor(userId: string, role: string) {
  if (role === "SELLER") {
    const agg = await prisma.conversation.aggregate({
      where: { sellerId: userId, sellerUnread: { gt: 0 } },
      _sum: { sellerUnread: true },
      _count: { _all: true },
    });
    return { messages: agg._sum.sellerUnread ?? 0, conversations: agg._count._all };
  }
  if (role === "BUYER") {
    const agg = await prisma.conversation.aggregate({
      where: { buyerId: userId, buyerUnread: { gt: 0 } },
      _sum: { buyerUnread: true },
      _count: { _all: true },
    });
    return { messages: agg._sum.buyerUnread ?? 0, conversations: agg._count._all };
  }
  return { messages: 0, conversations: 0 };
}
