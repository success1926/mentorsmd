import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/email";

export const dynamic = "force-dynamic";

// A private calendar feed (.ics) for one user: their booked calls, plus
// due dates for mentors. Google Calendar, Outlook and Apple Calendar all
// "subscribe" to a URL like this and refresh it on their own schedule
// (Google every few hours, Apple/Outlook more often).
//
// The token in the URL is the only thing protecting it, so it's long and
// random, and the user can reset it from Account -> Calendar & calls.
function esc(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function day(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = (params.token || "").replace(/\.ics$/, "");
  if (token.length < 20) return new Response("Not found", { status: 404 });

  const user = await prisma.user.findUnique({ where: { calendarToken: token }, select: { id: true, role: true } });
  if (!user) return new Response("Not found", { status: 404 });

  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const [bookings, dueOrders] = await Promise.all([
    prisma.callBooking.findMany({
      where: {
        status: "BOOKED",
        startTime: { gte: since },
        order: { OR: [{ buyerId: user.id }, { sellerId: user.id }], status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } },
      },
      include: { order: { include: { gig: { select: { title: true } }, buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
      take: 500,
    }),
    user.role === "SELLER"
      ? prisma.order.findMany({
          where: { sellerId: user.id, status: "IN_ESCROW", dueDate: { not: null, gte: since } },
          include: { gig: { select: { title: true } }, buyer: { select: { name: true } } },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MentorsMD//Calls//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:MentorsMD",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const b of bookings) {
    const other = b.order.buyerId === user.id ? b.order.seller.name : b.order.buyer.name;
    lines.push(
      "BEGIN:VEVENT",
      `UID:call-${b.id}@mentorsmd`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(b.startTime)}`,
      `DTEND:${stamp(b.endTime)}`,
      `SUMMARY:${esc(`MentorsMD call with ${other}`)}`,
      `DESCRIPTION:${esc(`${b.order.gig.title}\nJoin here: ${SITE_URL}/calls/${b.id}\nOrder: ${SITE_URL}/orders/${b.orderId}`)}`,
      `URL:${SITE_URL}/calls/${b.id}`,
      "END:VEVENT"
    );
  }

  for (const o of dueOrders as any[]) {
    const start = new Date(o.dueDate);
    const end = new Date(start.getTime() + 24 * 3600_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:due-${o.id}@mentorsmd`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${day(start)}`,
      `DTEND;VALUE=DATE:${day(end)}`,
      `SUMMARY:${esc(`Due: ${o.gig.title} for ${o.buyer.name}`)}`,
      `URL:${SITE_URL}/orders/${o.id}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mentorsmd.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
