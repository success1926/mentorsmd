"use client";

// Browser side of every file upload (lib/storage.ts explains the setup).
//  1. Ask one of our routes for an upload link. The route checks who you
//     are, the file type and size, and picks the storage path.
//  2. Send the file straight to Supabase Storage with that link (so big
//     files aren't blocked by Vercel's 4.5MB request limit).
//  3. Return the path (and, for public photos, the public address) so the
//     page can save it.
export type Uploaded = { path: string; name: string; publicUrl?: string };

export async function uploadFile(endpoint: string, file: File, extra: Record<string, unknown> = {}): Promise<Uploaded> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.signedUrl) throw new Error(data.error || "Upload failed. Please try again.");

  // Same request format as supabase-js's uploadToSignedUrl.
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const put = await fetch(data.signedUrl, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
  if (!put.ok) {
    const err = await put.json().catch(() => ({}));
    const msg = String(err?.message || err?.error || "");
    if (/size|too large|exceed/i.test(msg) || put.status === 413) throw new Error("That file is too large.");
    if (/mime|type/i.test(msg)) throw new Error("That file type isn't supported.");
    throw new Error("Upload failed. Please try again.");
  }
  return { path: data.path, name: file.name.slice(0, 150), publicUrl: data.publicUrl };
}
