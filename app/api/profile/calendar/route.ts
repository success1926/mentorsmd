import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/email";
import { requireUser } from "@/lib/session";

// "Connect your calendar": creates (or resets) the private feed URL that
// Google Calendar / Outlook / Apple Calendar subscribe to. See
// /api/calendar/[token] for the feed itself.
function feedUrl(token: string) {
  return `${SITE_URL}/api/calendar/${token}.ics`;
}

export async function GET() {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { calendarToken: true } });
  return NextResponse.json({ feedUrl: user?.calendarToken ? feedUrl(user.calendarToken) : null });
}

// Creates a feed, or replaces the old one (the old URL stops working).
export async function POST() {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: me.id }, data: { calendarToken: token } });
  return NextResponse.json({ feedUrl: feedUrl(token) });
}

// Disconnect: the feed URL stops working everywhere it was added.
export async function DELETE() {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  await prisma.user.update({ where: { id: me.id }, data: { calendarToken: null } });
  return NextResponse.json({ feedUrl: null });
}
