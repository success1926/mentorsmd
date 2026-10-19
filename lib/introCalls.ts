// Free 15-minute intro calls (docs/redesign-2026-10.md section 1). A
// student can book one with any listed mentor, no message needed first.
// It uses the same calendar, private Daily room, recording and attendance
// as order calls, but has no order and no payment and never counts as
// hours. Once it's held, the student can buy from that mentor
// (lib/unlock.ts). One per student and mentor: CallBooking.introKey is
// unique while the call counts, and cleared when it's cancelled or the
// mentor doesn't show up, so a new one can be booked. Server only.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTRO_CALL_MINUTES } from "@/lib/options";
import { dayInZone, tzOrDefault } from "@/lib/tz";
import { CallError, assertNoClashFor, lockMentor, mentorScheduleSelect, openSlotsFor } from "@/lib/callBooking";
import { deleteRoom, ensureRoom } from "@/lib/daily";
import { buildCallIcs } from "@/lib/ics";
import { CallEmail, SITE_URL, fromAddress, sendIntroCallBookedEmail, sendIntroCallCancelledEmail } from "@/lib/email";
import { isMentorListed } from "@/lib/mentor";
import { gateBlockReason } from "@/lib/gate";
import { blockBetween } from "@/lib/blocks";
import { isEmailConfirmed } from "@/lib/emailVerification";

export const INTRO_TITLE = "Free 15-minute intro call";

export const introKeyFor = (studentId: string, mentorId: string) => `${studentId}:${mentorId}`;

// The student's intro call with this mentor that still counts (booked,
// or already happened), or null if they can book one.
export function currentIntroCall(studentId: string, mentorId: string) {
  return prisma.callBooking.findUnique({ where: { introKey: introKeyFor(studentId, mentorId) } });
}

const mentorSelect = {
  ...mentorScheduleSelect,
  role: true,
  profileStatus: true,
  pausedUntil: true,
  safetyHoldAt: true,
  profileCompleteAt: true,
  acceptsMinors: true,
} as const;

type IntroMentor = Prisma.UserGetPayload<{ select: typeof mentorSelect }>;

export function loadIntroMentor(mentorId: string) {
  return prisma.user.findUnique({ where: { id: mentorId }, select: mentorSelect });
}

// Why this student can't book an intro call with this mentor, or null.
export async function introBlockReason(studentId: string, mentor: IntroMentor | null): Promise<string | null> {
  if (!mentor || mentor.role !== "SELLER") return "That mentor doesn't exist";
  if (!isMentorListed(mentor)) return "This mentor isn't taking new students right now";
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true, createdAt: true, emailVerified: true, safetyHoldAt: true, minorStatus: true },
  });
  if (!student || student.role !== "BUYER") return "Only student accounts can book an intro call";
  if (student.safetyHoldAt) return "Your account is paused while our team reviews it, so you can't book calls right now.";
  const gate = await gateBlockReason(studentId);
  if (gate) return gate;
  if (student.minorStatus && !mentor.acceptsMinors) return "This mentor works with students 18 and over. Please choose another mentor.";
  const blocks = await blockBetween(studentId, mentor.id);
  if (blocks.iBlocked) return "You blocked this mentor. Unblock them from their profile first.";
  if (blocks.theyBlocked) return "You can't book a call with this mentor.";
  if (!(await isEmailConfirmed(student))) return "Please confirm your email first. We sent you a link when you signed up.";
  return null;
}

export function openIntroSlots(mentor: IntroMentor, studentId: string, onlyDay?: string) {
  return openSlotsFor(mentor, studentId, INTRO_CALL_MINUTES, { onlyDay });
}

// The conversation between them (made if needed): where the call is
// managed, and where the mentor can reply.
async function conversationFor(studentId: string, mentorId: string) {
  return prisma.conversation.upsert({
    where: { buyerId_sellerId: { buyerId: studentId, sellerId: mentorId } },
    update: {},
    create: { buyerId: studentId, sellerId: mentorId },
  });
}

type Person = { id: string; name: string; email: string; timeZone: string | null };

function introEmail(
  booking: { id: string; startTime: Date; endTime: Date; icsSequence: number },
  me: Person,
  other: Person,
  conversationId: string,
  method: "REQUEST" | "CANCEL"
): CallEmail & { email: string } {
  const joinUrl = `${SITE_URL}/calls/${booking.id}`;
  const manageUrl = `${SITE_URL}/messages/${conversationId}`;
  return {
    email: me.email,
    gigTitle: INTRO_TITLE,
    start: booking.startTime,
    end: booking.endTime,
    timeZone: tzOrDefault(me.timeZone),
    otherName: other.name,
    orderUrl: manageUrl,
    joinUrl,
    ics: buildCallIcs({
      bookingId: booking.id,
      method,
      sequence: booking.icsSequence,
      start: booking.startTime,
      end: booking.endTime,
      summary: `MentorsMD intro call with ${other.name}`,
      description: `${INTRO_TITLE}\nJoin here: ${joinUrl}\nMessages: ${manageUrl}`,
      url: joinUrl,
      organizerEmail: fromAddress(),
      attendees: [{ name: me.name, email: me.email }],
    }),
  };
}

async function emailBoth(booking: any, student: Person, mentor: Person, conversationId: string, kind: "booked" | "cancelled", byName?: string) {
  const pairs: [Person, Person][] = [
    [student, mentor],
    [mentor, student],
  ];
  await Promise.all(
    pairs.map(async ([me, other]) => {
      const c = introEmail(booking, me, other, conversationId, kind === "cancelled" ? "CANCEL" : "REQUEST");
      try {
        if (kind === "cancelled") await sendIntroCallCancelledEmail(c.email, c, byName || "Someone");
        else await sendIntroCallBookedEmail(c.email, c);
      } catch (err) {
        console.error(`Intro call ${kind} email failed`, err);
      }
    })
  );
}

// Books the student's intro call at an open 15-minute slot.
export async function bookIntroCall(studentId: string, mentorId: string, start: Date) {
  const mentor = await loadIntroMentor(mentorId);
  const blocked = await introBlockReason(studentId, mentor);
  if (blocked || !mentor) throw new CallError(blocked || "That mentor doesn't exist", 403);
  if (await currentIntroCall(studentId, mentorId)) throw new CallError("You already have an intro call with this mentor.", 409);
  if (start.getTime() < Date.now() + 5 * 60_000) throw new CallError("Pick a time in the future.");
  const slots = await openIntroSlots(mentor, studentId, dayInZone(start, tzOrDefault(mentor.timeZone)));
  if (!slots.some((s) => s.getTime() === start.getTime())) throw new CallError("That time isn't available anymore. Please pick another.", 409);
  const end = new Date(start.getTime() + INTRO_CALL_MINUTES * 60_000);

  const conversation = await conversationFor(studentId, mentorId);
  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      await lockMentor(tx, mentorId);
      await assertNoClashFor(tx, mentorId, studentId, start, end, mentor.bufferMinutes);
      return tx.callBooking.create({
        data: {
          kind: "INTRO",
          studentId,
          mentorId,
          introKey: introKeyFor(studentId, mentorId),
          startTime: start,
          endTime: end,
          status: "BOOKED",
          source: "SITE",
          scheduledAt: new Date(),
          bookedById: studentId,
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new CallError("You already have an intro call with this mentor.", 409);
    }
    throw err;
  }

  const room = await ensureRoom(booking).catch(() => null);
  const saved = room ? await prisma.callBooking.update({ where: { id: booking.id }, data: { roomName: room.name, roomUrl: room.url } }) : booking;
  const student = await prisma.user.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true, email: true, timeZone: true } });
  await emailBoth(saved, student, mentor, conversation.id, "booked");
  return { booking: saved, conversationId: conversation.id };
}

// Cancels an intro call (the 24-hour rule is checked by the route), so a
// new one can be booked.
export async function cancelIntroCall(bookingId: string, by: { id: string; name: string }) {
  const res = await prisma.callBooking.updateMany({
    where: { id: bookingId, kind: "INTRO", status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: by.id, icsSequence: { increment: 1 }, introKey: null },
  });
  if (res.count === 0) throw new CallError("This call isn't active anymore. Refresh the page.", 409);
  const booking = await prisma.callBooking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      student: { select: { id: true, name: true, email: true, timeZone: true } },
      mentor: { select: { id: true, name: true, email: true, timeZone: true } },
    },
  });
  await deleteRoom(booking.roomName).catch(() => {});
  if (booking.student && booking.mentor) {
    const conversation = await conversationFor(booking.student.id, booking.mentor.id);
    await emailBoth(booking, booking.student, booking.mentor, conversation.id, "cancelled", by.name);
  }
  return booking;
}
