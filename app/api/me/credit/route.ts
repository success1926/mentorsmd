import { NextResponse } from "next/server";
import { creditBalance, creditEntries } from "@/lib/credit";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The student's MentorsMD credit balance and recent entries (dashboard,
// and "Credit applied" on the profile's buy pop-up).
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ balanceCents: 0, entries: [] });
  const userId = (session.user as any).id;
  const [balanceCents, entries] = await Promise.all([creditBalance(userId), creditEntries(userId, 20, { forStudent: true })]);
  return NextResponse.json({ balanceCents, entries });
}
