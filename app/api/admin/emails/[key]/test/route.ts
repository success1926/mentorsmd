import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { sendTestEmail } from "@/lib/email";
import { EMAILS, validateTemplate } from "@/lib/emailTemplates";
import { rateLimit, tooMany } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const TEST_LIMIT = { name: "email-test-h", max: 30, windowSec: 3600 };

// Admin -> Emails -> "Send test to me": the wording in the editor, filled
// with sample data, sent only to the logged-in admin's own address.
export async function POST(req: Request, { params }: { params: { key: string } }) {
  const admin = await currentAdmin("emails");
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const def = EMAILS[params.key];
  if (!def) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const limit = await rateLimit(TEST_LIMIT, admin.id);
  if (!limit.ok) return tooMany(limit.retryAfterSec, "That's a lot of test emails. Please wait a bit and try again.");

  const input = await req.json().catch(() => ({}));
  const tpl = {
    subject: typeof input.subject === "string" ? input.subject.trim() : def.subject,
    body: typeof input.body === "string" ? input.body.replace(/\r\n?/g, "\n").trim() : def.body,
  };
  const errors = validateTemplate(def, tpl);
  if (errors.length) return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  try {
    await sendTestEmail(def.key, admin.email, tpl);
  } catch (err) {
    console.error("Test email failed:", err);
    return NextResponse.json({ error: "The test email couldn't be sent. Check Admin -> Email log for the reason." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to: admin.email });
}
