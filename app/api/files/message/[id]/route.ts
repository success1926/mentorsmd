import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminCan } from "@/lib/adminTeam";
import { fileRedirect } from "@/lib/storage";
import { requireUser } from "@/lib/session";

// Download a message attachment. Only the two people in the conversation,
// or an admin with the Flags permission (reviewing a flagged thread), get
// the file; everyone else gets "not found".
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await requireUser();
  if (me instanceof NextResponse) return me;
  const userId = me.id;

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    select: { attachmentUrl: true, attachmentName: true, conversation: { select: { buyerId: true, sellerId: true } } },
  });
  if (!message?.attachmentUrl) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const party = message.conversation.buyerId === userId || message.conversation.sellerId === userId;
  if (!party && !(me.role === "ADMIN" && (await adminCan("flags")))) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  return fileRedirect(message.attachmentUrl, message.attachmentName);
}
