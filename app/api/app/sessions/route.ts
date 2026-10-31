import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { activeAppSessions, endAppSession } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

// Phones signed in to the MentorsMD app, for Settings on the website and
// in the app. Anyone fully logged in (not halfway through 2-step).
//   GET                              -> { sessions: [...] } (current: this phone)
//   POST { action: "sign-out", id }  ends one phone's session
const FULL_ROLES = ["ADMIN", "SELLER", "BUYER"];

async function me() {
  const session = await getSession();
  const u = session?.user as any;
  if (!u?.id || !FULL_ROLES.includes(u.role)) return null;
  return { id: u.id as string, appSessionId: (session as any).appSessionId as string | undefined };
}

export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sessions = await activeAppSessions(user.id);
  return NextResponse.json({ sessions: sessions.map((s) => ({ ...s, current: s.id === user.appSessionId })) });
}

export async function POST(req: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "sign-out" && typeof body.id === "string") {
    const ok = await endAppSession(user.id, body.id);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "That phone is already signed out." }, { status: 404 });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
