import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminCan } from "@/lib/adminTeam";
import { CANCEL_CUTOFF_HOURS, canChangeOnline } from "@/lib/calls";
import { CallError } from "@/lib/callBooking";
import { cancelIntroCall } from "@/lib/introCalls";

// Cancels a free intro call: the student or mentor until 24 hours before
// the start, admins any time. The student can then book a new one.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = session.user as any;

  const booking = await prisma.callBooking.findUnique({ where: { id: params.id } });
  const isAdmin = user.role === "ADMIN" && (await adminCan("calls"));
  if (!booking || booking.kind !== "INTRO" || (booking.studentId !== user.id && booking.mentorId !== user.id && !isAdmin)) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (booking.status !== "BOOKED") return NextResponse.json({ error: "This call isn't active anymore" }, { status: 400 });
  if (!isAdmin && !canChangeOnline(booking)) {
    return NextResponse.json(
      { error: `Calls can't be cancelled on the site within ${CANCEL_CUTOFF_HOURS} hours of the start. Message the other person, or contact us.` },
      { status: 400 }
    );
  }
  const who = isAdmin ? "The MentorsMD team" : user.name || (booking.mentorId === user.id ? "Your mentor" : "Your student");
  try {
    await cancelIntroCall(booking.id, { id: user.id, name: who });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof CallError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Intro call cancel failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
