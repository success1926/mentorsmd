import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unreadFor } from "@/lib/unread";

export const dynamic = "force-dynamic";

// Small status the top bar polls: unread messages, and for mentors how
// many packages they have (to show "+ Add package" vs "My packages").
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ unread: 0, unreadConversations: 0, packageCount: null });
  const userId = (session.user as any).id;
  const role = (session.user as any).role;

  const [unread, packageCount] = await Promise.all([
    unreadFor(userId, role),
    role === "SELLER" ? prisma.gig.count({ where: { sellerId: userId, active: true } }) : Promise.resolve(null),
  ]);
  return NextResponse.json({ unread: unread.messages, unreadConversations: unread.conversations, packageCount });
}
