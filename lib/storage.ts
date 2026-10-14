import crypto from "crypto";
import { NextResponse } from "next/server";
import { ENV_TAG, NOT_SET_UP, SUPABASE_URL, supabaseAdmin } from "@/lib/supabase";

// File storage on Supabase (replaced Vercel Blob in Oct 2026).
//
// Two buckets (created in the Supabase project, see
// prisma/supabase-storage-realtime-2026-10.sql):
//  - private-files: message attachments, delivery files, mentor résumés.
//    Nobody can read these directly. The database stores the file's PATH,
//    and a download goes through one of our routes, which checks who is
//    asking and then sends them to a link that works for 5 minutes.
//  - public-media: mentor profile photos and Admin -> Website photos.
//    Anyone can view these; the database stores the full public address.
//
// Uploads never go through our server (Vercel caps requests at 4.5MB):
// a route checks who the person is and what they may upload, then hands
// the browser a one-time upload link for one exact path (lib/upload.ts).
//
// Files uploaded before the move are still Vercel Blob addresses
// (https://...blob.vercel-storage.com/...). Anything starting with "http"
// is treated as one of those and keeps working.

export const PRIVATE_BUCKET = "private-files";
export const PUBLIC_BUCKET = "public-media";

type Bucket = typeof PRIVATE_BUCKET | typeof PUBLIC_BUCKET;
// Folders inside the buckets. Each path is <live|preview>/<folder>/...
export type Folder = "attachments" | "applications" | "avatars" | "site";

export const isLegacyUrl = (v: unknown): boolean => typeof v === "string" && /^https?:\/\//i.test(v);

// Keeps letters, numbers, dots, dashes and underscores; never empty.
export function safeFileName(name: string, fallback = "file") {
  return name.slice(0, 150).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "") || fallback;
}

export const fileExtension = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

// A fresh, unguessable path: live/attachments/<userId>/<random>/<name>.
export function newPath(folder: Folder, fileName: string, ownerId?: string) {
  const parts = [ENV_TAG, folder, ownerId, crypto.randomUUID(), safeFileName(fileName)].filter(Boolean);
  return parts.join("/");
}

// The folder prefix a path must start with, e.g. "live/attachments/<userId>/".
export const pathPrefix = (folder: Folder, ownerId?: string) => [ENV_TAG, folder, ownerId].filter(Boolean).join("/") + "/";

// Is this a path we would have handed out for this folder (and person)?
export function isOurPath(value: unknown, folder: Folder, ownerId?: string): value is string {
  return (
    typeof value === "string" &&
    value.length <= 400 &&
    value.startsWith(pathPrefix(folder, ownerId)) &&
    !value.includes("..") &&
    !value.includes("//") &&
    /^[a-zA-Z0-9._\-/]+$/.test(value)
  );
}

// A one-time link the browser uploads one file to (lib/upload.ts).
export async function createUploadLink(bucket: Bucket, path: string): Promise<{ path: string; signedUrl: string } | { error: string }> {
  const sb = supabaseAdmin();
  if (!sb) return { error: NOT_SET_UP };
  const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Couldn't create an upload link:", error);
    return { error: "Upload failed. Please try again." };
  }
  return { path: data.path, signedUrl: data.signedUrl };
}

// The JSON a "give me an upload link" route returns.
export async function uploadLinkResponse(bucket: Bucket, path: string, extra: Record<string, unknown> = {}) {
  const link = await createUploadLink(bucket, path);
  if ("error" in link) return NextResponse.json({ error: link.error }, { status: 503 });
  return NextResponse.json({ ...link, ...extra });
}

// Public address of a file in public-media.
export function publicUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// public-media path from its public address (for deleting it).
export function publicPathFromUrl(url: string): string | null {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/`;
  return SUPABASE_URL && url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : null;
}

// Size of a stored file in bytes, or null if it isn't there.
export async function fileSize(bucket: Bucket, path: string): Promise<number | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const slash = path.lastIndexOf("/");
  const { data, error } = await sb.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 10 });
  if (error || !data) return null;
  const f = data.find((o) => o.name === path.slice(slash + 1));
  const size = (f?.metadata as any)?.size;
  return typeof size === "number" ? size : null;
}

// Reads a private file into memory (e.g. to attach a résumé to an email).
// Old Vercel Blob addresses are fetched directly.
export async function readFile(value: string): Promise<Buffer | null> {
  if (isLegacyUrl(value)) {
    const res = await fetch(value);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  const sb = supabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(PRIVATE_BUCKET).download(value);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeFiles(bucket: Bucket, paths: string[]) {
  const sb = supabaseAdmin();
  if (!sb || !paths.length) return;
  const { error } = await sb.storage.from(bucket).remove(paths);
  if (error) console.error("Couldn't delete stored files:", error);
}

// Sends the person to the file. Call only AFTER checking they may see it.
// Private files get a link that works for 5 minutes and downloads with the
// original file name; old Vercel Blob addresses are used as they are.
export async function fileRedirect(value: string | null | undefined, downloadName?: string | null) {
  if (!value) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (isLegacyUrl(value)) return NextResponse.redirect(`${value}${value.includes("?") ? "&" : "?"}download=1`);
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: NOT_SET_UP }, { status: 503 });
  const name = (downloadName || value.split("/").pop() || "file").replace(/[\r\n"]/g, "").slice(0, 150);
  const { data, error } = await sb.storage.from(PRIVATE_BUCKET).createSignedUrl(value, 300, { download: name });
  if (error || !data) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
