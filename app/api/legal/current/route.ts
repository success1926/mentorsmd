import { NextResponse } from "next/server";
import { currentVersions, docOrDefault } from "@/lib/legal";

export const dynamic = "force-dynamic";

// Public: the current version number of each legal document, plus the
// Mentor Agreement text (shown in full on the mentor join page).
export async function GET() {
  const [versions, mentorAgreement] = await Promise.all([currentVersions(), docOrDefault("MENTOR_AGREEMENT")]);
  return NextResponse.json({ versions, mentorAgreement });
}
