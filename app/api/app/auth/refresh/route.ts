import { NextResponse } from "next/server";
import { appSignInEnabled, refreshAppSession } from "@/lib/appAuth";

export const dynamic = "force-dynamic";

// The phone app trades its refresh token for a new access token and a new
// refresh token (lib/appAuth.ts). { refreshToken } -> { accessToken,
// refreshToken, expiresIn, user }, or 401: show the sign-in screen.
export async function POST(req: Request) {
  if (!appSignInEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const tokens = await refreshAppSession(body.refreshToken);
  if (!tokens) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  return NextResponse.json(tokens);
}
