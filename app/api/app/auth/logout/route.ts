import { NextResponse } from "next/server";
import { endAppSessionByRefresh } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

// "Sign out" in the phone app: ends this phone's session. { refreshToken }
// Always answers ok, so the app can forget its tokens either way.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  await endAppSessionByRefresh(body.refreshToken).catch((err) => console.error("Couldn't end an app session:", err));
  return NextResponse.json({ ok: true });
}
