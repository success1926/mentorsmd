import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordingAccessLink } from "@/lib/daily";
import { getSession } from "@/lib/session";

// "Watch recording" for the mentor in their package workspace (redesign
// Oct 2026): a short-lived link from Daily, like Admin's, for recordings of
// calls on their own hours packages. Never stored; students can't use it.
export async function POST(_req: Request, { params }: { params: { id: string; recId: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;
  const rec = await prisma.callRecording.findUnique({
    where: { id: params.recId },
    select: { dailyRecordingId: true, deletedAt: true, booking: { select: { orderId: true, order: { select: { sellerId: true, kind: true } } } } },
  });
  if (!rec || rec.booking.orderId !== params.id || rec.booking.order?.sellerId !== userId || !rec.booking.order?.kind) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }
  if (rec.deletedAt) return NextResponse.json({ error: "This recording was deleted" }, { status: 410 });
  const url = await recordingAccessLink(rec.dailyRecordingId);
  if (!url) return NextResponse.json({ error: "The recording isn't ready yet. It may still be processing." }, { status: 502 });
  return NextResponse.json({ url });
}
