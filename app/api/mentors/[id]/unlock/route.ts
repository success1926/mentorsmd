import { NextResponse } from "next/server";
import { unlockState } from "@/lib/unlock";
import { introBlockReason, loadIntroMentor } from "@/lib/introCalls";
import { canChangeOnline } from "@/lib/calls";
import { getSession, sessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// For the mentor's public profile: can this student buy yet (lib/unlock.ts),
// and their free intro call with this mentor (booked, held, or can book).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = sessionUser(await getSession());
  if (!me || me.role !== "BUYER") {
    return NextResponse.json({ error: "Log in with a student account" }, { status: 401 });
  }
  const studentId = me.id;
  const [state, mentor] = await Promise.all([unlockState(studentId, params.id), loadIntroMentor(params.id)]);
  const introBlocked = state.introCall ? null : await introBlockReason(studentId, mentor);
  return NextResponse.json({
    ...state,
    introCall: state.introCall ? { ...state.introCall, canCancel: state.introCall.status === "BOOKED" && canChangeOnline(state.introCall) } : null,
    canBookIntro: !state.introCall && !introBlocked,
    introBlockedReason: introBlocked,
  });
}
