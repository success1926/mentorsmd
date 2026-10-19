import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLive } from "@/lib/realtime";
import { SITE_URL, sendMoreHoursSuggestedEmail } from "@/lib/email";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { blockBetween } from "@/lib/blocks";
import { gateBlockReason } from "@/lib/gate";
import { aiCheckAndFlag, checkOutgoingMessage, flagSavedMessage } from "@/lib/messageSafety";
import { runAfterResponse } from "@/lib/request";
import { finishPhase } from "@/lib/finishing";
import { hoursSummary, TOP_UP_HOURS } from "@/lib/hours";
import { hoursLabel } from "@/lib/pricing";

// The mentor suggests the student adds hours to a package: { hours: one of
// TOP_UP_HOURS, note?, acknowledgeWarnings? }. Posts a message in the
// package's thread (same safety checks as any message) and emails the
// student a link that opens "Add hours" with that number picked. Nothing is
// charged until the student adds them. Once every 6 hours per package.
const NOTE_MAX = 600;
const COOLDOWN_HOURS = 6;
const SUGGESTION_PREFIX = "Suggested adding";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const mentorId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));
  const hours = Number(body.hours);
  if (!TOP_UP_HOURS.includes(hours)) return NextResponse.json({ error: "Pick how many hours to suggest" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > NOTE_MAX) return NextResponse.json({ error: `Please keep the note under ${NOTE_MAX} characters` }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      hourEntries: { select: { type: true, minutes: true, voidedAt: true, callBookingId: true } },
      callBookings: { select: { id: true, startTime: true, endTime: true, status: true, outcome: true, kind: true } },
      buyer: { select: { id: true, email: true, name: true } },
      seller: { select: { id: true, name: true, createdAt: true } },
      gig: { select: { title: true } },
    },
  });
  if (!order || order.sellerId !== mentorId || !order.kind) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (finishPhase(order) !== "WORKING") return NextResponse.json({ error: "You can only suggest more hours while the package is in progress." }, { status: 400 });
  if (!order.conversationId) return NextResponse.json({ error: "This package has no message thread." }, { status: 400 });

  // Same account checks as any message (updated legal documents etc.).
  const gate = await gateBlockReason(mentorId);
  if (gate) return NextResponse.json({ error: gate, code: "ACCOUNT_GATE" }, { status: 403 });
  const blocks = await blockBetween(mentorId, order.buyerId);
  if (blocks.iBlocked || blocks.theyBlocked) return NextResponse.json({ error: "You can't message this student." }, { status: 403 });
  for (const limit of [RATE_LIMITS.messagesPerMinute, RATE_LIMITS.messagesPerDay]) {
    const r = await rateLimit(limit, mentorId);
    if (!r.ok) return tooMany(r.retryAfterSec, "You're sending messages too quickly. Please wait a moment and try again.");
  }
  const recent = await prisma.message.findFirst({
    where: { orderId: order.id, senderId: mentorId, body: { startsWith: SUGGESTION_PREFIX }, createdAt: { gt: new Date(Date.now() - COOLDOWN_HOURS * 3600_000) } },
    select: { id: true },
  });
  if (recent) return NextResponse.json({ error: `You already suggested more hours in the last ${COOLDOWN_HOURS} hours. You can still message the student.` }, { status: 429 });

  const title = order.packageTitle || order.gig.title;
  const text = `${SUGGESTION_PREFIX} ${hoursLabel(hours * 60)} to this package.${note ? `\n\n${note}` : ""}\n\nYou can add them with "Add hours" on the package page. Nothing is charged unless you do.`;
  const verdict = await checkOutgoingMessage({ text, attachmentName: null, sender: order.seller, conversationId: order.conversationId, acknowledgedWarnings: body.acknowledgeWarnings === true });
  if ("error" in verdict) return NextResponse.json({ error: verdict.error, code: verdict.code, warnings: verdict.warnings }, { status: verdict.status });

  const message = await prisma.message.create({
    data: { body: text, conversationId: order.conversationId, senderId: mentorId, orderId: order.id },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });
  await flagSavedMessage(verdict.findings, { id: message.id, body: text, attachmentName: null, senderId: mentorId, conversationId: order.conversationId });
  if (note) runAfterResponse(() => aiCheckAndFlag(note, "message", { subjectUserId: mentorId, conversationId: order.conversationId!, messageId: message.id }));
  await prisma.conversation.update({ where: { id: order.conversationId }, data: { buyerUnread: { increment: 1 } } });
  await sendLive([order.buyerId, order.sellerId], "message", { conversationId: order.conversationId, message });

  try {
    await sendMoreHoursSuggestedEmail(order.buyer.email, {
      mentorName: order.seller.name,
      packageTitle: title,
      hours: hoursLabel(hours * 60),
      hoursLeft: hoursLabel(hoursSummary(order).left),
      note,
      addHoursUrl: `${SITE_URL}/orders/${order.id}?add_hours=${hours}`,
    });
  } catch (err) {
    console.error("More-hours suggestion email failed", order.id, err);
  }
  return NextResponse.json({ message });
}
