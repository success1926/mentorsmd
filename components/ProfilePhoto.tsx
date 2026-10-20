"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";

// Crops the chosen image to a centered square and shrinks it to 600x600
// JPEG in the browser, so uploads are small and every photo is the same shape.
async function toSquareJpeg(file: File, size = 600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be read as an image"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this image");
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/jpeg", 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The mentor's profile photo with Upload / Change / Remove (My profile, step 1).
export function ProfilePhoto({ name, photoUrl, onChanged }: { name: string; photoUrl: string | null; onChanged: (url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setMsg("");
    if (!file.type.startsWith("image/")) return setMsg("Please choose an image file (JPG, PNG or WebP).");
    setBusy(true);
    try {
      const square = await toSquareJpeg(file);
      const form = new FormData();
      form.append("file", new File([square], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChanged(data.photoUrl);
      setMsg("Photo updated.");
    } catch (err: any) {
      setMsg(err.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setBusy(true);
    const res = await fetch("/api/profile/photo", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setMsg("Couldn't remove the photo. Try again.");
    onChanged(null);
    setMsg("Photo removed.");
  }

  return (
    <div className="row" style={{ gap: 20, flexWrap: "wrap" }}>
      <Avatar name={name || "?"} photoUrl={photoUrl} style={{ width: 88, height: 88, fontSize: 32 }} />
      <div className="stack-sm grow" style={{ minWidth: 220 }}>
        <b>Profile photo</b>
        <span className="text-secondary small">A clear, friendly headshot works best. We crop it to a square automatically.</span>
        <div className="row-wrap">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => handlePhoto(e.target.files?.[0])} />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && <button type="button" className="btn btn-sm" disabled={busy} onClick={removePhoto}>Remove</button>}
        </div>
        {msg && <span role="status" className="text-secondary small">{msg}</span>}
      </div>
    </div>
  );
}
