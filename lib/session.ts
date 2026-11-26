import { getServerSession, type Session } from "next-auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { bearerFrom, sessionFromAccessToken } from "@/lib/appAuth";

// Who is making this request: the website's login cookie, or the phone
// app's access token ("Authorization: Bearer ...", lib/appAuth.ts). API
// routes use this instead of getServerSession, so every route works for
// both. A request that sends a Bearer header is judged on that token
// alone (never the cookie), so a bad token can't fall back to a browser
// login.
export async function getSession(): Promise<Session | null> {
  let authorization: string | null = null;
  try {
    authorization = headers().get("authorization");
  } catch {
    authorization = null;
  }
  const bearer = bearerFrom(authorization);
  if (bearer !== null) return sessionFromAccessToken(bearer);
  return getServerSession(authOptions);
}

// The signed-in person, typed (session.user only carries id and role as
// untyped extras, set in lib/auth.ts and lib/appAuth.ts). role is the
// session role, which is "ADMIN_2FA" / "SELLER_2FA" / "BUYER_2FA" until
// 2-step verification is finished.
export type SessionUser = { id: string; role: string; name: string | null; email: string | null; image: string | null };

export function sessionUser(session: Session | null): SessionUser | null {
  const u = session?.user as (Session["user"] & { id?: string; role?: string }) | undefined;
  if (!u?.id) return null;
  return { id: u.id, role: u.role ?? "", name: u.name ?? null, email: u.email ?? null, image: u.image ?? null };
}

const notSignedIn = () => NextResponse.json({ error: "Not authenticated" }, { status: 401 });

// For API routes:
//   const me = await requireUser();
//   if (me instanceof NextResponse) return me;
// Answers 401 "Not authenticated" when nobody is signed in.
export async function requireUser(): Promise<SessionUser | NextResponse> {
  return sessionUser(await getSession()) ?? notSignedIn();
}

// Same, but someone signed in with another role also gets 401 "Not
// authenticated" (routes with their own wording for that check it themselves).
export async function requireRole(...roles: string[]): Promise<SessionUser | NextResponse> {
  const me = sessionUser(await getSession());
  return me && roles.includes(me.role) ? me : notSignedIn();
}
