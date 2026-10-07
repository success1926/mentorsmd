import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordingAccessLink } from "@/lib/daily";

// Admin-only "Watch recording": asks Daily for a short-lived link to the
// recording. The link is never stored or shown to the student or mentor.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const rec = await prisma.callRecording.findUnique({ where: { id: params.id } });
  if (!rec) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  if (rec.deletedAt) return NextResponse.json({ error: "This recording was deleted" }, { status: 410 });
  const url = await recordingAccessLink(rec.dailyRecordingId);
  if (!url) return NextResponse.json({ error: "Daily couldn't provide the recording. It may still be processing." }, { status: 502 });
  return NextResponse.json({ url });
}
