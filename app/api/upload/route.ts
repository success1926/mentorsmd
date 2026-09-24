import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";

// Used for attaching files (essay drafts, PDFs, images) to a message.
// A 10MB cap keeps this from being used to upload huge files by mistake;
// raise MAX_SIZE if your use case genuinely needs bigger attachments.
const MAX_SIZE = 10 * 1024 * 1024;

// Only document and image types a coaching conversation needs. Blocks
// .html/.svg/.js etc, which could be used to host phishing pages or
// scripts on a URL that looks like it came from your site.
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "txt", "rtf", "odt", "pages",
  "ppt", "pptx", "key", "xls", "xlsx", "csv",
  "png", "jpg", "jpeg", "gif", "webp", "heic",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });
  }

  // Strip path characters and anything unusual from the name.
  const originalName = file.name.slice(0, 150);
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "_") || "file";
  const ext = safeName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: "That file type isn't supported. Try a PDF, Word doc, or image." }, { status: 400 });
  }

  const userId = (session.user as any).id;
  const blob = await put(`messages/${userId}/${safeName}`, file, {
    access: "public",
    addRandomSuffix: true, // unguessable URL, and no overwriting someone else's file
  });

  return NextResponse.json({ url: blob.url, name: originalName });
}
