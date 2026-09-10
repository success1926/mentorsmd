import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Powers the disabled/enabled state of the due-date picker on the frontend.
// Same rule the checkout route enforces server-side - this just lets the
// UI reflect it before the buyer tries to pay.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sellerId = searchParams.get("sellerId");
  if (!sellerId) return NextResponse.json({ error: "sellerId is required" }, { status: 400 });

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "BUYER") {
    return NextResponse.json({ error: "Not authenticated as a buyer" }, { status: 401 });
  }
  const buyerId = (session.user as any).id;

  const conversation = await prisma.conversation.findUnique({
    where: { buyerId_sellerId: { buyerId, sellerId } },
  });
  if (!conversation) {
    return NextResponse.json({ canPickDueDate: false, reason: "not_messaged" });
  }

  const [buyerCount, sellerCount] = await Promise.all([
    prisma.message.count({ where: { conversationId: conversation.id, senderId: buyerId } }),
    prisma.message.count({ where: { conversationId: conversation.id, senderId: sellerId } }),
  ]);

  if (buyerCount === 0) return NextResponse.json({ canPickDueDate: false, reason: "not_messaged" });
  if (sellerCount === 0) return NextResponse.json({ canPickDueDate: false, reason: "awaiting_reply" });
  return NextResponse.json({ canPickDueDate: true });
}
