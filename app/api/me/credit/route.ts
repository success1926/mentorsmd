import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { creditBalance, creditEntries } from "@/lib/credit";

export const dynamic = "force-dynamic";

// The student's MentorsMD credit balance and recent entries (dashboard,
// and "Credit applied" on the profile's buy pop-up).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ balanceCents: 0, entries: [] });
  const userId = (session.user as any).id;
  const [balanceCents, entries] = await Promise.all([creditBalance(userId), creditEntries(userId, 20)]);
  return NextResponse.json({ balanceCents, entries });
}
