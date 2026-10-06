import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { homeForRole, sessionEndReason } from "@/lib/sessionRules";

// Runs before the pages below load:
//  - Pages that need a login send logged-out visitors to /login, then
//    back to the same page afterwards.
//  - Login and signup send people who are already logged in to their
//    own home page instead of offering a second account.
const PROTECTED = ["/account", "/dashboard", "/messages", "/orders", "/admin", "/gigs"];
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const ended = token ? sessionEndReason(token) : null;
  const loggedIn = !!token && !ended;

  if (!loggedIn && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", pathname + search);
    if (ended) url.searchParams.set("reason", ended === "revoked" ? "ended" : "idle");
    return NextResponse.redirect(url);
  }

  if (loggedIn && AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = homeForRole(token!.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/:path*",
    "/messages/:path*",
    "/orders/:path*",
    "/admin/:path*",
    "/gigs/:path*",
    "/login",
    "/signup/:path*",
  ],
};
