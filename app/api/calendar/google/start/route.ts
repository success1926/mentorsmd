import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GOOGLE_CAL_STATE_COOKIE, googleCalConfigured, googleConsentUrl, makeState, siteBase } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

// Mentor clicks "Connect Google Calendar" -> sent to Google's consent
// screen. A signed state value goes along, and the same value is kept in
// a 10-minute httpOnly cookie that the callback checks.
export async function GET(req: Request) {
  const base = siteBase(req.url);
  // Google sends people back to the site's main address, so start there
  // too (otherwise the state cookie would be on the other host).
  if (new URL(req.url).origin !== new URL(base).origin) {
    return NextResponse.redirect(`${base}/api/calendar/google/start`);
  }
  const back = (flag: string) => NextResponse.redirect(`${base}/account?gcal=${flag}#calendar`);
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent("/account#calendar")}`);
  if ((session.user as any).role !== "SELLER") return back("mentors-only");
  if (!googleCalConfigured()) return back("not-set-up");

  const state = makeState((session.user as any).id);
  const res = NextResponse.redirect(googleConsentUrl(req.url, state.value));
  res.cookies.set(GOOGLE_CAL_STATE_COOKIE, state.value, {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax", // sent when Google redirects back (a normal link click)
    path: "/api/calendar/google",
    maxAge: state.maxAge,
  });
  return res;
}
