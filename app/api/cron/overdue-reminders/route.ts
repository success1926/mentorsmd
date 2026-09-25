import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOverdueReminderEmail, SITE_URL } from "@/lib/email";
import { isAuthorizedCron } from "@/lib/cron";

export const maxDuration = 60;
const BATCH_SIZE = 100;

// Runs once a day (see vercel.json). Finds every order that's past its
// due date, still IN_ESCROW (seller hasn't marked it complete), and
// either has never gotten a reminder or didn't get one in the last 20
// hours (20hr rather than 24 gives the daily schedule some slack).
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const twentyHoursAgo = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const overdueOrders = await prisma.order.findMany({
    where: {
      status: "IN_ESCROW",
      dueDate: { lt: now },
      OR: [{ reminderLastSentAt: null }, { reminderLastSentAt: { lt: twentyHoursAgo } }],
    },
    include: { seller: { select: { email: true } }, gig: { select: { title: true } } },
    orderBy: { dueDate: "asc" },
    take: BATCH_SIZE,
  });

  const results = [];
  for (const order of overdueOrders) {
    try {
      await sendOverdueReminderEmail(order.seller.email, order.gig.title, order.dueDate!, `${SITE_URL}/orders/${order.id}`);
      await prisma.order.update({ where: { id: order.id }, data: { reminderLastSentAt: now } });
      results.push({ orderId: order.id, reminded: true });
    } catch (err: any) {
      console.error(`Overdue reminder failed for order ${order.id}:`, err);
      // Still stamp it, so one bad email address can't block the batch.
      await prisma.order.update({ where: { id: order.id }, data: { reminderLastSentAt: now } }).catch(() => {});
      results.push({ orderId: order.id, reminded: false, error: err.message });
    }
  }

  return NextResponse.json({ checked: overdueOrders.length, results });
}
