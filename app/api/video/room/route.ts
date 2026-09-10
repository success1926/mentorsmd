import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Uses Daily.co because it needs the least setup: one REST call returns a
// room URL you can drop straight into an <iframe> on the frontend. Twilio
// Video or Zoom SDK are the other common choices if you outgrow this.
// Get a Daily API key at https://dashboard.daily.co and set DAILY_API_KEY.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { conversationId } = await req.json();
  const userId = (session.user as any).id;

  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const dailyRes = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // room expires in 1 hour
        enable_chat: false, // keep chat in our own message thread, not Daily's
        max_participants: 2,
      },
    }),
  });

  if (!dailyRes.ok) {
    const errText = await dailyRes.text();
    return NextResponse.json({ error: `Couldn't create video room: ${errText}` }, { status: 502 });
  }

  const room = await dailyRes.json();
  return NextResponse.json({ url: room.url });
}
