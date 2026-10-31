import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { PRIVATE_BUCKET, fileExtension, newPath, safeFileName, uploadLinkResponse } from "@/lib/storage";
import { getSession } from "@/lib/session";

// Upload link for a file attached to a message or a delivery (essay
// drafts, PDFs, images). The browser then sends the file straight to
// private storage (lib/upload.ts) and the message / delivery saves its path.
// Body: { name, size, conversationId } or { name, size, orderId }.
//
// A 10MB cap keeps this from being used to upload huge files by mistake
// (the private-files bucket enforces the same limit).
const MAX_SIZE = 10 * 1024 * 1024;

// Only document and image types a coaching conversation needs. Blocks
// .html/.svg/.js etc, which could be used to host phishing pages or
// scripts. (Downloads are always sent as attachments, never shown inline.)
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "txt", "rtf", "odt", "pages",
  "ppt", "pptx", "key", "xls", "xlsx", "csv",
  "png", "jpg", "jpeg", "gif", "webp", "heic",
]);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const limit = await rateLimit(RATE_LIMITS.uploadsPerHour, userId);
  if (!limit.ok) return tooMany(limit.retryAfterSec, "You've uploaded a lot of files in the last hour. Please try again later.");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const size = Number(body?.size);
  if (!name) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  if (size > MAX_SIZE) return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });

  const safeName = safeFileName(name);
  if (!ALLOWED_EXTENSIONS.has(fileExtension(safeName))) {
    return NextResponse.json({ error: "That file type isn't supported. Try a PDF, Word doc, or image." }, { status: 400 });
  }

  // Only the two people in a conversation can attach to it; only the
  // order's mentor can attach files to a delivery.
  if (typeof body?.conversationId === "string") {
    const convo = await prisma.conversation.findUnique({ where: { id: body.conversationId }, select: { buyerId: true, sellerId: true } });
    if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
  } else if (typeof body?.orderId === "string") {
    const order = await prisma.order.findUnique({ where: { id: body.orderId }, select: { sellerId: true } });
    if (!order || order.sellerId !== userId) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  return uploadLinkResponse(PRIVATE_BUCKET, newPath("attachments", safeName, userId));
}
