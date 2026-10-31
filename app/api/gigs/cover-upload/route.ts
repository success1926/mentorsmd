import { NextResponse } from "next/server";
import { PUBLIC_BUCKET, fileExtension, newPath, publicUrl, safeFileName, uploadLinkResponse } from "@/lib/storage";
import { RATE_LIMITS, rateLimit, tooMany } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

// Cover photos for specialized packages. Like Admin -> Website photos, the
// browser uploads straight to the public-media bucket (lib/upload.ts); this
// route only hands a mentor a one-time upload link for an image up to 8MB in
// "covers/<their id>/". The package form saves the returned public address
// (with the focus point the mentor clicks, lib/imageFocus.ts); the package
// API checks it's one of this mentor's covers.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user || (session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentors can add package photos" }, { status: 403 });
  }
  const userId = (session.user as any).id;
  const r = await rateLimit(RATE_LIMITS.uploadsPerHour, userId);
  if (!r.ok) return tooMany(r.retryAfterSec, "Too many uploads. Please try again later.");

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const size = Number(body?.size);
  if (!IMAGE_TYPES.includes(body?.type) || !/^(jpe?g|png|webp|avif)$/.test(fileExtension(name))) {
    return NextResponse.json({ error: "Photos must be JPG, PNG, WebP or AVIF" }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "Photos must be 8MB or smaller" }, { status: 400 });
  }
  const path = newPath("covers", safeFileName(name, "cover.jpg"), userId);
  return uploadLinkResponse(PUBLIC_BUCKET, path, { publicUrl: publicUrl(path) });
}
