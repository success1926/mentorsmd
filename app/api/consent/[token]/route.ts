import { NextResponse } from "next/server";
import { declineConsent, giveConsent } from "@/lib/minors";
import { requestMeta } from "@/lib/legal";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { ipKey } from "@/lib/request";

// A parent or guardian answers the consent request (#108). No login: the
// secret link from the email is the proof.
//   { action: "consent", signature: "Full Name", confirm: true }
//   { action: "decline" }
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const r = await rateLimit(RATE_LIMITS.parentPagePerIpHour, ipKey(req));
  if (!r.ok) return tooMany(r.retryAfterSec);
  const body = await req.json().catch(() => ({}));

  if (body.action === "decline") {
    const res = await declineConsent(params.token);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "consent") {
    const signature = typeof body.signature === "string" ? body.signature.trim() : "";
    if (signature.length < 3 || signature.length > 200 || !/\s/.test(signature)) {
      return NextResponse.json({ error: "Type your full name (first and last) to sign" }, { status: 400 });
    }
    if (body.confirm !== true) {
      return NextResponse.json({ error: "Please confirm you are this student's parent or legal guardian" }, { status: 400 });
    }
    const res = await giveConsent(params.token, signature, requestMeta(req));
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
