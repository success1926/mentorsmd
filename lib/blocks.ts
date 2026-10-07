import { prisma } from "@/lib/prisma";

// Blocking: once either person blocks the other, neither can send
// messages to the other (or start a new conversation).
export async function blockBetween(a: string, b: string) {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { blockerId: true },
  });
  return { iBlocked: rows.some((r) => r.blockerId === a), theyBlocked: rows.some((r) => r.blockerId === b) };
}
