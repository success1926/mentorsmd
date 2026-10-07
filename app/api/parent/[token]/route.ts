import { NextResponse } from "next/server";
import { withdrawConsent } from "@/lib/minors";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

// The parent's private page (#109): withdraw consent. No login; the
// secret link from the consent email is the proof.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const r = await rateLimit(RATE_LIMITS.parentPagePerIpHour, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec);
  const body = await req.json().catch(() => ({}));
  if (body.action !== "withdraw") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const res = await withdrawConsent(params.token);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
