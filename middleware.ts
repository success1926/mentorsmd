import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { homeForRole, sessionEndReason, twoStepPending, verifyPathFor } from "@/lib/sessionRules";

// Runs before every page and API (not static files):
//  - Pages that need a login send logged-out visitors to /login, then
//    back to the same page afterwards.
//  - Login and signup send people who are already logged in to their
//    own home page instead of offering a second account.
//  - Someone who still owes their 2-step code (lib/mfa.ts) is sent to the
//    code page from any page except the few below (so a Google sign-in
//    that lands on a public page still asks for the code). APIs:
//      - the few the code page uses work as normal,
//      - public ones (forms, email links, gifts) work as if they were
//        logged out (the login cookie isn't passed on),
//      - everything else answers "not logged in" until they enter it.
const PROTECTED = ["/account", "/dashboard", "/messages", "/orders", "/admin", "/gigs", "/calls", "/calendar", "/credit", "/receipts", "/about-you", "/two-step"];
const AUTH_PAGES = ["/login", "/signup"];
// Pages someone who still owes their code can open (besides their own
// code page): the legal pages, and links from emails that don't depend on
// who's logged in.
const PAGES_WHILE_PENDING = [
  "/terms", "/privacy", "/community-guidelines", "/mentor-agreement", "/parental-consent", "/safety",
  "/verify-email", "/reset-password", "/forgot-password", "/gift", "/consent", "/parent", "/waitlist/remove", "/join-team", "/become-a-mentor/join", "/leaving",
];
// APIs a person who still owes their code can use. (/api/reminders/stop
// is a signed link from an email that doesn't depend on who's logged in.)
const OPEN_WHILE_PENDING = ["/api/auth/", "/api/two-step", "/api/admin/2fa", "/api/track", "/api/client-error", "/api/reminders/"];
// Public APIs: used as if logged out while the code is owed.
const PUBLIC_APIS = [
  "/api/contact", "/api/waitlist", "/api/applications", "/api/gift", "/api/email/verify", "/api/password/forgot", "/api/password/reset",
  "/api/parent", "/api/consent", "/api/legal/current", "/api/invites/prefill", "/api/team-invite", "/api/gigs", "/api/webhooks", "/api/cron",
];
const under = (pathname: string, list: string[]) => list.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/"));

// The request without the NextAuth login cookie (any of its names, and
// the numbered pieces of a large one), so the route sees a logged-out visitor.
function withoutLoginCookie(req: NextRequest) {
  const headers = new Headers(req.headers);
  const kept = req.cookies
    .getAll()
    .filter((c) => !/^(__Secure-|__Host-)?next-auth\.session-token(\.\d+)?$/.test(c.name))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`);
  if (kept.length) headers.set("cookie", kept.join("; "));
  else headers.delete("cookie");
  return NextResponse.next({ request: { headers } });
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const ended = token ? sessionEndReason(token) : null;
  const loggedIn = !!token && !ended;

  if (loggedIn && twoStepPending(token)) {
    if (pathname.startsWith("/api/")) {
      if (under(pathname, OPEN_WHILE_PENDING)) return NextResponse.next();
      // The calendar feed (/api/calendar/<token>) is public; connecting
      // Google Calendar (/api/calendar/google/...) needs the login.
      if (under(pathname, PUBLIC_APIS) || (pathname.startsWith("/api/calendar/") && !pathname.startsWith("/api/calendar/google"))) {
        return withoutLoginCookie(req);
      }
      return NextResponse.json({ error: "Finish logging in first (enter your 2-step code)." }, { status: 401 });
    }
    const verifyPath = verifyPathFor(token!.role);
    if (pathname !== verifyPath && !under(pathname, PAGES_WHILE_PENDING)) {
      const url = req.nextUrl.clone();
      url.pathname = verifyPath;
      url.search = "";
      if (!under(pathname, AUTH_PAGES)) url.searchParams.set("next", pathname + search);
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

// Every page and API, but not Next's own files or static files (anything
// ending in .png, .svg, .ico, .txt, .xml...).
export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
