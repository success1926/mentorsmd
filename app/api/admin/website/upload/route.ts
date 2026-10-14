import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { currentAdmin } from "@/lib/adminTeam";

// Photo uploads for Admin -> Website. The browser uploads straight to
// Vercel Blob (like the resume upload); this route only hands out a
// short-lived permission, to admins only, for an image up to 8MB in "site/".
const SITE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await currentAdmin())) throw new Error("Admin access required");
        if (!pathname.startsWith("site/") || pathname.includes("..")) throw new Error("Invalid file name");
        if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(pathname)) throw new Error("Photos must be JPG, PNG, WebP, GIF or AVIF");
        return { allowedContentTypes: SITE_IMAGE_TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
