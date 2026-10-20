import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUBLIC_BUCKET, newPath, publicPathFromUrl, publicUrl, removeFiles } from "@/lib/storage";
import { supabaseAdmin, NOT_SET_UP } from "@/lib/supabase";
import { syncProfileComplete } from "@/lib/profileSync";

// Profile photo upload, stored in the public-media bucket (lib/storage.ts).
// The browser already crops/resizes the image to a square before sending
// (components/ProfilePhoto.tsx), so files here are small enough to come through our
// server, which checks the file really is an image before storing it.
const MAX_SIZE = 2 * 1024 * 1024; // the browser sends ~100KB; this is headroom

// Checks the file's first bytes, not just the type the browser claims.
function looksLikeImage(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp")
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

// Simple abuse guard: at most this many photo changes per account per hour.
const MAX_UPLOADS_PER_HOUR = 10;
const recentUploads = new Map<string, number[]>();
const ALLOWED_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // Only coaches have public photos.
  if ((session.user as any).role !== "SELLER") {
    return NextResponse.json({ error: "Only mentors can add a profile photo" }, { status: 403 });
  }
  const userId = (session.user as any).id;

  const now = Date.now();
  const times = (recentUploads.get(userId) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (times.length >= MAX_UPLOADS_PER_HOUR) {
    return NextResponse.json({ error: "Too many photo changes - try again in an hour" }, { status: 429 });
  }
  recentUploads.set(userId, [...times, now]);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "No photo provided" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Please use a JPG, PNG, or WebP image" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Photo is too large (2MB max)" }, { status: 400 });
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!looksLikeImage(head, file.type)) {
    return NextResponse.json({ error: "That file doesn't look like a valid image" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: NOT_SET_UP }, { status: 503 });
  // A new path each time, so browsers never show a cached old photo.
  const path = newPath("avatars", `photo.${ext}`, userId);
  const { error } = await sb.storage.from(PUBLIC_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error("Profile photo upload failed:", error);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  const photoUrl = publicUrl(path);

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
  await prisma.user.update({ where: { id: userId }, data: { photoUrl } });
  await syncProfileComplete(userId);

  // Clean up the old file so storage doesn't fill with replaced photos.
  await removeOldPhoto(previous?.photoUrl);

  return NextResponse.json({ photoUrl });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const userId = (session.user as any).id;

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { photoUrl: true } });
  await prisma.user.update({ where: { id: userId }, data: { photoUrl: null } });
  await syncProfileComplete(userId);
  await removeOldPhoto(previous?.photoUrl);
  return NextResponse.json({ photoUrl: null });
}

// Deletes a replaced photo if it's one of ours in Supabase Storage. (Old
// Vercel Blob photos are left alone; that store is being retired.)
async function removeOldPhoto(url: string | null | undefined) {
  const path = url ? publicPathFromUrl(url) : null;
  if (path && /^(live|preview)\/avatars\//.test(path)) await removeFiles(PUBLIC_BUCKET, [path]);
}
