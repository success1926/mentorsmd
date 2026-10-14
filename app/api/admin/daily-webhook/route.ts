import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { SITE_URL } from "@/lib/email";
import { createWebhook } from "@/lib/daily";

// Admin-only, used once: tells Daily to send attendance and recording
// events to /api/webhooks/daily. Shows the webhook secret, which the
// owner then saves in Vercel as DAILY_WEBHOOK_SECRET.
export async function POST() {
  const admin = await currentAdmin("calls");
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  // Only from the live site: a preview's address changes with every
  // deployment, so Daily would end up sending events to a dead address.
  if (process.env.VERCEL_ENV !== "production" || !SITE_URL.startsWith("https://")) {
    return NextResponse.json({ error: "This only works on the live site (an https address, not a preview)" }, { status: 400 });
  }
  const res = await createWebhook(`${SITE_URL}/api/webhooks/daily`);
  if (!res.ok) {
    const reason = res.data?.info || res.data?.error || `Daily answered ${res.status}`;
    return NextResponse.json({ error: `Couldn't create the webhook: ${reason}. If you've connected it before, it's probably already set up.` }, { status: 502 });
  }
  return NextResponse.json({ secret: res.data?.hmac || null, url: res.data?.url || `${SITE_URL}/api/webhooks/daily` });
}
