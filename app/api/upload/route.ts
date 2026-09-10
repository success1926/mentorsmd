import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";

// Used for attaching files (essay drafts, PDFs, images) to a message.
// Vercel Blob is the simplest option here: no bucket configuration, no
// separate AWS account - just a token and a function call. Works the same
// whether your app itself is hosted on Vercel or elsewhere.
//
// A 10MB cap keeps this from being used to upload huge files by mistake;
// raise MAX_SIZE if your use case genuinely needs bigger attachments.
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File is too large (10MB max)" }, { status: 400 });
  }

  const blob = await put(`messages/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url, name: file.name });
}
