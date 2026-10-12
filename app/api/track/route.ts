import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, rateLimit } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";
import { attributionFromCookieHeader, isBotUserAgent, recordActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// Records a site visit or a mentor profile view in the private activity
// log (#86). Called by components/Tracker.tsx. Anyone can call it, so it
// only accepts these two kinds, is rate limited per connection, ignores
// bots, and never returns anything but { ok }.
//   { kind: "VISIT", path }
//   { kind: "PROFILE_VIEW", mentorId }
export async function POST(req: Request) {
  const ok = NextResponse.json({ ok: true });
  if (isBotUserAgent(req.headers.get("user-agent"))) return ok;
  const limit = await rateLimit(RATE_LIMITS.trackPerIpHour, ipKey(req));
  if (!limit.ok) return ok;

  const body = await req.json().catch(() => ({}));
  const { visitorId, source } = attributionFromCookieHeader(req.headers.get("cookie"));
  const session = await getServerSession(authOptions);
  const userId: string | null = (session?.user as any)?.id || null;
  const role: string | null = (session?.user as any)?.role || null;
  // Staff browsing the site isn't customer activity.
  if (role === "ADMIN" || role === "ADMIN_2FA") return ok;
  if (!visitorId && !userId) return ok;

  if (body.kind === "VISIT") {
    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : null;
    await recordActivity({ kind: "VISIT", visitorId, userId, source: source?.source || null, path });
    return ok;
  }

  if (body.kind === "PROFILE_VIEW" && typeof body.mentorId === "string" && /^[a-z0-9]{10,40}$/i.test(body.mentorId)) {
    if (body.mentorId === userId) return ok; // a mentor looking at their own profile
    const mentor = await prisma.user.findUnique({ where: { id: body.mentorId }, select: { role: true } });
    if (mentor?.role !== "SELLER") return ok;
    await recordActivity({ kind: "PROFILE_VIEW", visitorId, userId, mentorId: body.mentorId });
    return ok;
  }

  return ok;
}
