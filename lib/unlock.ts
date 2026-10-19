// Unlocking a mentor (docs/redesign-2026-10.md section 1). A student can
// always message a mentor and book one free intro call. Buying anything
// is unlocked once EITHER the mentor has replied to the student in their
// conversation, OR the student's intro call with that mentor was held
// (lib/callOutcomes.ts). Having bought from them before also counts.
// Until then every Buy button reads "Message or book an intro call to
// unlock". Server only.
import { prisma } from "@/lib/prisma";
import { currentIntroCall } from "@/lib/introCalls";

export type UnlockReason = "MENTOR_REPLIED" | "INTRO_HELD" | "ORDERED_BEFORE";

export type UnlockState = {
  unlocked: boolean;
  reason: UnlockReason | null;
  conversationId: string | null;
  messaged: boolean; // the student has sent at least one message
  introCall: { id: string; startTime: Date; endTime: Date; status: string; outcome: string | null } | null;
};

export async function unlockState(studentId: string, mentorId: string): Promise<UnlockState> {
  const [conversation, intro, ordered] = await Promise.all([
    prisma.conversation.findUnique({ where: { buyerId_sellerId: { buyerId: studentId, sellerId: mentorId } }, select: { id: true } }),
    currentIntroCall(studentId, mentorId),
    prisma.order.count({ where: { buyerId: studentId, sellerId: mentorId, status: { in: ["IN_ESCROW", "COMPLETED", "RELEASED"] } } }),
  ]);
  const [mentorReplies, studentMessages] = conversation
    ? await Promise.all([
        prisma.message.count({ where: { conversationId: conversation.id, senderId: mentorId } }),
        prisma.message.count({ where: { conversationId: conversation.id, senderId: studentId } }),
      ])
    : [0, 0];

  const introHeld = !!intro && intro.status !== "CANCELLED" && intro.outcome === "HELD";
  const reason: UnlockReason | null = mentorReplies > 0 ? "MENTOR_REPLIED" : introHeld ? "INTRO_HELD" : ordered > 0 ? "ORDERED_BEFORE" : null;
  return {
    unlocked: reason !== null,
    reason,
    conversationId: conversation?.id ?? null,
    messaged: studentMessages > 0,
    introCall: intro ? { id: intro.id, startTime: intro.startTime, endTime: intro.endTime, status: intro.status, outcome: intro.outcome } : null,
  };
}

export async function isUnlocked(studentId: string, mentorId: string) {
  return (await unlockState(studentId, mentorId)).unlocked;
}
