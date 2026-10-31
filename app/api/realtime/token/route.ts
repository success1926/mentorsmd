import { NextResponse } from "next/server";
import { isPending2faRole } from "@/lib/sessionRules";
import { realtimeToken } from "@/lib/realtime";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// A one-hour pass for live updates (lib/realtime.ts explains the setup).
// It only lets the browser listen to the signed-in person's own topic.
// { enabled: false } when Supabase isn't set up; pages then work as before
// without live updates.
export async function GET() {
  const session = await getSession();
  const user = session?.user as any;
  if (!user?.id || isPending2faRole(user.role)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const pass = realtimeToken(user.id);
  const res = NextResponse.json(pass ? { enabled: true, ...pass } : { enabled: false });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
