import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { homeForRole, sessionEndReason, twoStepPending, verifyPathFor } from "@/lib/sessionRules";

// Runs before the pages below load:
//  - Pages that need a login send logged-out visitors to /login, then
//    back to the same page afterwards.
//  - Login and signup send people who are already logged in to their
//    own home page instead of offering a second account.
//  - Someone who still owes their 2-step code (lib/mfa.ts) is sent to the
//    code page from any page that needs a login, and every API except the
//    few the code page uses answers "not logged in" until they enter it.
const PROTECTED = ["/account", "/dashboard", "/messages", "/orders", "/admin", "/gigs", "/calls", "/calendar", "/credit", "/receipts", "/about-you", "/two-step"];
const AUTH_PAGES = ["/login", "/signup"];
// APIs a person who still owes their code can use. (/api/reminders/stop
// is a signed link from an email that doesn't depend on who's logged in.)
const OPEN_WHILE_PENDING = ["/api/auth/", "/api/two-step", "/api/admin/2fa", "/api/track", "/api/client-error", "/api/reminders/"];
const under = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const ended = token ? sessionEndReason(token) : null;
  const loggedIn = !!token && !ended;

  if (loggedIn && twoStepPending(token)) {
    if (pathname.startsWith("/api/")) {
      if (under(pathname, OPEN_WHILE_PENDING)) return NextResponse.next();
      return NextResponse.json({ error: "Finish logging in first (enter your 2-step code)." }, { status: 401 });
    }
    const verifyPath = verifyPathFor(token!.role);
    if (pathname !== verifyPath && under(pathname, [...PROTECTED, ...AUTH_PAGES])) {
      const url = req.nextUrl.clone();
      url.pathname = verifyPath;
      url.search = "";
      if (!under(pathname, AUTH_PAGES) && pathname !== "/two-step" && pathname !== "/admin/verify") url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Other API calls are checked by each route itself.
  if (pathname.startsWith("/api/")) return NextResponse.next();

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
    "/calls/:path*",
    "/calendar",
    "/credit",
    "/receipts/:path*",
    "/about-you",
    "/login",
    "/signup/:path*",
    "/two-step",
    "/api/:path*",
  ],
};
