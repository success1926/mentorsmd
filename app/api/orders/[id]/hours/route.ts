import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDayString } from "@/lib/tz";
import { isOurPath } from "@/lib/storage";
import { checkText } from "@/lib/moderation";
import { createFlagsForFindings } from "@/lib/flags";
import { HoursError, logWrittenWork } from "@/lib/hourLog";
import { getSession } from "@/lib/session";

// The mentor logs written work on a package: { minutes: 30 | 60, workDate:
// "YYYY-MM-DD", note, fileUrl?, fileName? } (the file is uploaded first
// through /api/upload with { orderId }). It can't go over the hours left.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const mentorId = (session.user as any).id;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 3) return NextResponse.json({ error: "Add a short note about what you worked on" }, { status: 400 });
  if (note.length > 2000) return NextResponse.json({ error: "Please keep the note under 2000 characters" }, { status: 400 });
  if (!isDayString(body.workDate)) return NextResponse.json({ error: "Pick the day you did the work" }, { status: 400 });
  const workDate = new Date(`${body.workDate}T12:00:00Z`);
  if (workDate.getTime() > Date.now() + 36 * 3600_000) return NextResponse.json({ error: "The day can't be in the future" }, { status: 400 });
  if (workDate.getTime() < Date.now() - 366 * 24 * 3600_000) return NextResponse.json({ error: "Pick a day in the last year" }, { status: 400 });
  const fileUrl = body.fileUrl || null;
  if (fileUrl && !isOurPath(fileUrl, "attachments", mentorId)) return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;

  try {
    const entry = await logWrittenWork(params.id, mentorId, { minutes: Number(body.minutes), workDate, note, fileUrl, fileName });
    // Safety word checks on the note and file name (flags for an admin only).
    const findings = [...checkText(note, "delivery").findings, ...(fileName ? checkText(fileName, "filename").findings : [])];
    if (findings.length) {
      const order = await prisma.order.findUnique({ where: { id: params.id }, select: { conversationId: true } });
      await createFlagsForFindings(findings, { evidence: [note, fileName ? `[file: ${fileName}]` : ""].join("\n"), subjectUserId: mentorId, orderId: params.id, conversationId: order?.conversationId ?? null });
    }
    return NextResponse.json({ entry });
  } catch (err) {
    if (err instanceof HoursError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Logging written work failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
