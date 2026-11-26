import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revokeGoogleToken } from "@/lib/googleCalendar";
import { getSession, sessionUser } from "@/lib/session";

// Mentor-only: disconnect Google Calendar. Tells Google to drop the
// permission (best effort), then forgets the token and the busy times read
// from it. A pasted iCal link, if any, stays and is re-read next time.
export async function POST() {
  const me = sessionUser(await getSession());
  if (!me || me.role !== "SELLER") {
    return NextResponse.json({ error: "Mentor accounts only" }, { status: 403 });
  }
  const userId = me.id as string;
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { googleCalRefreshToken: true } });
  await revokeGoogleToken(row?.googleCalRefreshToken);
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalEmail: null,
      googleCalRefreshToken: null,
      googleCalConnectedAt: null,
      externalBusy: [],
      externalBusyFetchedAt: null,
      externalCalError: null,
    },
  });
  return NextResponse.json({ ok: true });
}
