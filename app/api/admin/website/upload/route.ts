import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/adminTeam";
import { PUBLIC_BUCKET, fileExtension, newPath, publicUrl, safeFileName, uploadLinkResponse } from "@/lib/storage";

// Photo uploads for Admin -> Website. The browser uploads straight to the
// public-media bucket (lib/upload.ts); this route only hands out a one-time
// upload link, to admins with the Website permission, for an image up to
// 8MB in "site/". The bucket itself also only accepts these image types
// and sizes. Returns the photo's public address for the page to save.
const SITE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await currentAdmin("website"))) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const size = Number(body?.size);
  if (!SITE_IMAGE_TYPES.includes(body?.type) || !/^(jpe?g|png|webp|gif|avif)$/.test(fileExtension(name))) {
    return NextResponse.json({ error: "Photos must be JPG, PNG, WebP, GIF or AVIF" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "Photos must be 8MB or smaller" }, { status: 400 });
  }
  const path = newPath("site", safeFileName(name, "photo.jpg"));
  return uploadLinkResponse(PUBLIC_BUCKET, path, { publicUrl: publicUrl(path) });
}
