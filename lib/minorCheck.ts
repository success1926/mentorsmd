import { prisma } from "@/lib/prisma";

// Used by lib/flags.ts (kept separate from lib/minors.ts to avoid a circular import).
// True when the student on this conversation / order (or the person) is under 18.
export async function involvesMinor(ctx: { subjectUserId?: string | null; conversationId?: string | null; orderId?: string | null }) {
  const ids: string[] = [];
  if (ctx.subjectUserId) ids.push(ctx.subjectUserId);
  if (ctx.conversationId) {
    const c = await prisma.conversation.findUnique({ where: { id: ctx.conversationId }, select: { buyerId: true } });
    if (c) ids.push(c.buyerId);
  }
  if (ctx.orderId) {
    const o = await prisma.order.findUnique({ where: { id: ctx.orderId }, select: { buyerId: true } });
    if (o) ids.push(o.buyerId);
  }
  if (!ids.length) return false;
  return (await prisma.user.count({ where: { id: { in: ids }, minorStatus: { not: null } } })) > 0;
}

