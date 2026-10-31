import { getServerSession, type Session } from "next-auth";
import { headers } from "next/headers";
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
