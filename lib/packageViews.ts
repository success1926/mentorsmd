// The packages (hours orders) a student or mentor sees in My packages, on
// their dashboard and in Messages (redesign Oct 2026, section 8). Server only.
import { prisma } from "@/lib/prisma";

export async function packagesFor(userId: string, role: string) {
  const isMentor = role === "SELLER";
  const orders = await prisma.order.findMany({
    where: { ...(isMentor ? { sellerId: userId } : { buyerId: userId }), kind: { not: null }, status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } },
    include: {
      gig: { select: { title: true } },
      buyer: { select: { id: true, name: true, photoUrl: true, minorStatus: true } },
      seller: { select: { id: true, name: true, credential: true, photoUrl: true } },
      hourEntries: { select: { id: true, type: true, minutes: true, voidedAt: true, callBookingId: true, workDate: true, note: true, createdAt: true } },
      callBookings: { select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true, createdAt: true } },
      topUps: { where: { status: "PAID" }, select: { id: true, minutes: true, paidAt: true } },
      conversation: { select: { id: true, buyerUnread: true, sellerUnread: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (!orders.length) return [];
  const ids = orders.map((o) => o.id);

  const [latest, latestTheirs, files] = await Promise.all([
    prisma.message.findMany({
      where: { orderId: { in: ids } },
      orderBy: { createdAt: "desc" },
      distinct: ["orderId"],
      select: { id: true, orderId: true, body: true, attachmentName: true, createdAt: true, senderId: true },
    }),
    // The other person's latest message on each package (My packages'
    // messages preview, and "suggested more hours" on the student home).
    prisma.message.findMany({
      where: { orderId: { in: ids }, senderId: { not: userId } },
      orderBy: { createdAt: "desc" },
      distinct: ["orderId"],
      select: { id: true, orderId: true, body: true, attachmentName: true, createdAt: true, senderId: true },
    }),
    prisma.message.groupBy({ by: ["orderId"], where: { orderId: { in: ids }, attachmentUrl: { not: null } }, _count: { _all: true } }),
  ]);

  // New messages per package: the conversation's unread messages (the
  // other person's latest ones) that were sent from that package's page.
  const unreadByOrder = new Map<string, number>();
  const convos = new Map<string, number>();
  for (const o of orders) {
    if (!o.conversation) continue;
    const n = isMentor ? o.conversation.sellerUnread : o.conversation.buyerUnread;
    if (n > 0) convos.set(o.conversation.id, Math.min(n, 100));
  }
  await Promise.all(
    Array.from(convos.entries()).map(async ([conversationId, n]) => {
      const rows = await prisma.message.findMany({
        where: { conversationId, senderId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: n,
        select: { orderId: true },
      });
      for (const r of rows) if (r.orderId) unreadByOrder.set(r.orderId, (unreadByOrder.get(r.orderId) || 0) + 1);
    })
  );

  return orders.map((o) => ({
    ...o,
    title: o.packageTitle || o.gig.title,
    latestMessage: latest.find((m) => m.orderId === o.id) || null,
    latestTheirs: latestTheirs.find((m) => m.orderId === o.id) || null,
    filesCount: files.find((f) => f.orderId === o.id)?._count._all || 0,
    newMessages: unreadByOrder.get(o.id) || 0,
  }));
}
