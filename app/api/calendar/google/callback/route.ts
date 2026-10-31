import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { GOOGLE_CAL_STATE_COOKIE, checkState, encryptToken, exchangeCode } from "@/lib/googleCalendar";
import { siteUrl } from "@/lib/siteUrl";
import { externalBusyFor, mentorScheduleSelect } from "@/lib/callBooking";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Google sends the mentor back here after the consent screen. We check the
// state, swap the one-time code for a refresh token, store it encrypted,
// read busy times once, and return to Calendar & availability with a flag
// the page shows.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = siteUrl();
  const stateCookie = cookies().get(GOOGLE_CAL_STATE_COOKIE)?.value;
  const back = (flag: string) => {
    const res = NextResponse.redirect(`${base}/dashboard/availability?gcal=${flag}#calendar`);
    res.cookies.set(GOOGLE_CAL_STATE_COOKIE, "", { path: "/api/calendar/google", maxAge: 0 });
    return res;
  };

  const session = await getSession();
  const userId = (session?.user as any)?.id as string | undefined;
  const stateUser = checkState(url.searchParams.get("state"), stateCookie);
  if (!userId || !stateUser || stateUser !== userId) return back("expired");
  if ((session!.user as any).role !== "SELLER") return back("mentors-only");
  // e.g. "access_denied" when the mentor clicks Cancel on Google's screen.
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  let result: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    result = await exchangeCode(code);
  } catch (err) {
    console.error("Google Calendar connect failed:", err);
    return back("error");
  }
  // Google lets people untick the calendar permission on its screen.
  if (!result.hasCalendarScope) return back("no-permission");
  if (!result.refreshToken) return back("error");

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalEmail: result.email?.slice(0, 320) || null,
      googleCalRefreshToken: encryptToken(result.refreshToken),
      googleCalConnectedAt: new Date(),
      externalBusy: [],
      externalBusyFetchedAt: null,
      externalCalError: null,
    },
  });
  // Read busy times now, so the Account page shows "last synced" straight
  // away. A failure here is saved as the calendar error and shown there.
  const mentor = await prisma.user.findUnique({ where: { id: userId }, select: mentorScheduleSelect });
  if (mentor) await externalBusyFor(mentor, true).catch(() => {});
  return back("connected");
}
