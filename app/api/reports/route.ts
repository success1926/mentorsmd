import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFlag } from "@/lib/flags";
import { reportReason } from "@/lib/reportReasons";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";

// Report a student or mentor (from a conversation or a profile). Goes to
// Admin -> Flags. Optionally blocks them at the same time.
//   { subjectUserId, reason, details?, conversationId?, messageId?, block? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Log in to report someone" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const limit = await rateLimit(RATE_LIMITS.reportsPerHour, userId);
  if (!limit.ok) return tooMany(limit.retryAfterSec, "You've sent a lot of reports. Please try again later, or contact us.");

  const body = await req.json().catch(() => ({}));
  const reason = reportReason(body.reason);
  if (!reason) return NextResponse.json({ error: "Pick a reason" }, { status: 400 });
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 2000) : "";
  if (reason.value === "OTHER" && details.length < 5) return NextResponse.json({ error: "Tell us briefly what happened" }, { status: 400 });
  if (typeof body.subjectUserId !== "string" || body.subjectUserId === userId) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const subject = await prisma.user.findUnique({ where: { id: body.subjectUserId }, select: { id: true, role: true, name: true } });
  if (!subject || subject.role === "ADMIN") return NextResponse.json({ error: "Person not found" }, { status: 404 });

  // The conversation (if given) must be between these two people. A
  // student can report any mentor's profile; anyone else needs a
  // conversation with the person.
  let conversationId: string | null = null;
  if (typeof body.conversationId === "string") {
    const c = await prisma.conversation.findUnique({ where: { id: body.conversationId }, select: { id: true, buyerId: true, sellerId: true } });
    const pair = c && [c.buyerId, c.sellerId];
    if (!pair || !pair.includes(userId) || !pair.includes(subject.id)) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    conversationId = c!.id;
  } else {
    const c = await prisma.conversation.findFirst({
      where: { OR: [{ buyerId: userId, sellerId: subject.id }, { buyerId: subject.id, sellerId: userId }] },
      select: { id: true },
    });
    conversationId = c?.id ?? null;
    if (!conversationId && subject.role !== "SELLER") return NextResponse.json({ error: "You can only report people you've talked to" }, { status: 403 });
  }

  // A specific message, quoted as evidence.
  let evidence: string | null = null;
  let messageId: string | null = null;
  if (typeof body.messageId === "string" && conversationId) {
    const m = await prisma.message.findFirst({ where: { id: body.messageId, conversationId, senderId: subject.id }, select: { id: true, body: true, attachmentName: true } });
    if (m) {
      messageId = m.id;
      evidence = [m.body, m.attachmentName ? `[file: ${m.attachmentName}]` : ""].filter(Boolean).join("\n");
    }
  }

  await createFlag({
    kind: "REPORT",
    source: "USER",
    severity: reason.severity,
    reason: `Reported: ${reason.label}`,
    details: details || null,
    evidence,
    subjectUserId: subject.id,
    reporterId: userId,
    conversationId,
    messageId,
  });

  if (body.block === true) {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: subject.id } },
      update: {},
      create: { blockerId: userId, blockedId: subject.id },
    });
  }

  return NextResponse.json({ ok: true });
}
