import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PENDING_2FA_ROLE } from "@/lib/adminTeam";
import { realtimeToken } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// A one-hour pass for live updates (lib/realtime.ts explains the setup).
// It only lets the browser listen to the signed-in person's own topic.
// { enabled: false } when Supabase isn't set up; pages then work as before
// without live updates.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id || user.role === PENDING_2FA_ROLE) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const pass = realtimeToken(user.id);
  const res = NextResponse.json(pass ? { enabled: true, ...pass } : { enabled: false });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
