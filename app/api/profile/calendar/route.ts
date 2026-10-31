import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/email";
import { getSession } from "@/lib/session";

// "Connect your calendar": creates (or resets) the private feed URL that
// Google Calendar / Outlook / Apple Calendar subscribe to. See
// /api/calendar/[token] for the feed itself.
function feedUrl(token: string) {
  return `${SITE_URL}/api/calendar/${token}.ics`;
}

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: (session.user as any).id }, select: { calendarToken: true } });
  return NextResponse.json({ feedUrl: user?.calendarToken ? feedUrl(user.calendarToken) : null });
}

// Creates a feed, or replaces the old one (the old URL stops working).
export async function POST() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: (session.user as any).id }, data: { calendarToken: token } });
  return NextResponse.json({ feedUrl: feedUrl(token) });
}

// Disconnect: the feed URL stops working everywhere it was added.
export async function DELETE() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await prisma.user.update({ where: { id: (session.user as any).id }, data: { calendarToken: null } });
  return NextResponse.json({ feedUrl: null });
}
