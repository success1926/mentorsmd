import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/validate";
import { isBot } from "@/lib/honeypot";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { clientIp, ipKey, runAfterResponse } from "@/lib/request";
import { RECAPTCHA_FAILED, verifyRecaptcha } from "@/lib/recaptcha";
import { CONTACT_LIMITS as L, CONTACT_TOPICS, contactTopicLabel } from "@/lib/leadOptions";
import { sendContactMessageEmail, sendContactReceivedEmail, SITE_URL } from "@/lib/email";

// Public: the message form on /contact. Saves it as a lead (Admin ->
// Leads -> Contact messages), emails the team inbox (reply-to the
// sender) and sends the sender a short confirmation.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (isBot(body)) return NextResponse.json({ ok: true });

  const burst = await rateLimit(RATE_LIMITS.contactPerIpHour, ipKey(req));
  if (!burst.ok) return tooMany(burst.retryAfterSec, "Too many messages from this connection. Please try again later, or email us instead.");
  if (!(await verifyRecaptcha(body.recaptchaToken, "contact", clientIp(req)))) {
    return NextResponse.json({ error: RECAPTCHA_FAILED }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.replace(/[\r\n]+/g, " ").trim() : "";
  const email = normalizeEmail(body.email);
  const topic = CONTACT_TOPICS.some((t) => t.value === body.topic) ? (body.topic as string) : "OTHER";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || name.length > L.name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!email) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (message.length < L.messageMin) return NextResponse.json({ error: "Please write a little more in your message." }, { status: 400 });
  if (message.length > L.message) return NextResponse.json({ error: `Please keep your message under ${L.message.toLocaleString("en-US")} characters.` }, { status: 400 });

  const perEmail = await rateLimit(RATE_LIMITS.contactPerEmailDay, email);
  if (!perEmail.ok) return tooMany(perEmail.retryAfterSec, "We've already received several messages from this email today. We'll reply soon.");

  const lead = await prisma.lead.create({
    data: { kind: "CONTACT", email, name, topic, message, ipHash: ipKey(req) },
  });

  // The emails go out after the reply, so a slow email service doesn't
  // keep the visitor waiting. Each attempt is in Admin -> Email log.
  runAfterResponse(async () => {
    await sendContactMessageEmail({ name, email, topic: contactTopicLabel(topic), message }, `${SITE_URL}/admin/leads?tab=CONTACT&open=${lead.id}`).catch((err) =>
      console.error("Failed to send the contact message to the team:", err)
    );
    await sendContactReceivedEmail(email, name).catch((err) => console.error("Failed to send the contact confirmation:", err));
  });

  return NextResponse.json({ ok: true });
}
