import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SITE_URL } from "@/lib/email";
import { createWebhook } from "@/lib/daily";

// Admin-only, used once: tells Daily to send attendance and recording
// events to /api/webhooks/daily. Shows the webhook secret, which the
// owner then saves in Vercel as DAILY_WEBHOOK_SECRET.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!SITE_URL.startsWith("https://")) {
    return NextResponse.json({ error: "This only works on the live site (NEXTAUTH_URL must start with https://)" }, { status: 400 });
  }
  const res = await createWebhook(`${SITE_URL}/api/webhooks/daily`);
  if (!res.ok) {
    const reason = res.data?.info || res.data?.error || `Daily answered ${res.status}`;
    return NextResponse.json({ error: `Couldn't create the webhook: ${reason}. If you've connected it before, it's probably already set up.` }, { status: 502 });
  }
  return NextResponse.json({ secret: res.data?.hmac || null, url: res.data?.url || `${SITE_URL}/api/webhooks/daily` });
}
