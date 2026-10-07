import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveFlag, type FlagAction } from "@/lib/flags";
import { LIMITS } from "@/lib/validate";

async function adminId() {
  const session = await getServerSession(authOptions);
  return session?.user && (session.user as any).role === "ADMIN" ? ((session.user as any).id as string) : null;
}

// The conversation around a flag (read-only, for the admin's review).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await adminId())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const flag = await prisma.flag.findUnique({ where: { id: params.id } });
  if (!flag) return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  if (!flag.conversationId) return NextResponse.json({ messages: [] });

  // Up to 15 messages before and 15 after the flagged one (or the last 30).
  const anchor = flag.messageId ? await prisma.message.findUnique({ where: { id: flag.messageId }, select: { createdAt: true } }) : null;
  const select = { id: true, body: true, attachmentName: true, attachmentUrl: true, createdAt: true, senderId: true, sender: { select: { name: true, role: true } } };
  let messages;
  if (anchor) {
    const [before, after] = await Promise.all([
      prisma.message.findMany({ where: { conversationId: flag.conversationId, createdAt: { lte: anchor.createdAt } }, orderBy: { createdAt: "desc" }, take: 16, select }),
      prisma.message.findMany({ where: { conversationId: flag.conversationId, createdAt: { gt: anchor.createdAt } }, orderBy: { createdAt: "asc" }, take: 15, select }),
    ]);
    messages = [...before.reverse(), ...after];
  } else {
    messages = (await prisma.message.findMany({ where: { conversationId: flag.conversationId }, orderBy: { createdAt: "desc" }, take: 30, select })).reverse();
  }
  return NextResponse.json({ messages, flaggedMessageId: flag.messageId });
}

// Close a flag: { action: DISMISS | WARN | PAUSE | REMOVE | REOPEN, note? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminId();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { action, note } = await req.json().catch(() => ({}));
  if (!["DISMISS", "WARN", "PAUSE", "REMOVE", "REOPEN"].includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (note !== undefined && note !== null && (typeof note !== "string" || note.length > LIMITS.reason * 2)) {
    return NextResponse.json({ error: "Note is too long" }, { status: 400 });
  }
  const result = await resolveFlag(params.id, admin, action as FlagAction, typeof note === "string" ? note : null);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
