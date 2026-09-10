import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOverdueReminderEmail, SITE_URL } from "@/lib/email";

// Runs once a day (see vercel.json). Finds every order that's past its
// due date, still IN_ESCROW (seller hasn't marked it complete), and
// either has never gotten a reminder or didn't get one in the last 20
// hours (the 20hr threshold, rather than exactly 24, gives the daily
// cron schedule some slack so a slightly-early or slightly-late run
// doesn't skip a day or send twice).
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
    include: { seller: true, gig: true },
  });

  const results = [];
  for (const order of overdueOrders) {
    try {
      await sendOverdueReminderEmail(order.seller.email, order.gig.title, order.dueDate!, `${SITE_URL}/orders/${order.id}`);
      await prisma.order.update({ where: { id: order.id }, data: { reminderLastSentAt: now } });
      results.push({ orderId: order.id, reminded: true });
    } catch (err: any) {
      console.error(`Overdue reminder failed for order ${order.id}:`, err);
      results.push({ orderId: order.id, reminded: false, error: err.message });
    }
  }

  return NextResponse.json({ checked: overdueOrders.length, results });
}
