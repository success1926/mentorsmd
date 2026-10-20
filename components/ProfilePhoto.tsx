"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PhotoCropper, type Crop } from "@/components/PhotoCropper";

// Cuts the chosen square out of the image (the person picks it in
// PhotoCropper; centered if not) and shrinks it to a 600x600 JPEG in the
// browser, so uploads are small and every photo is the same shape.
async function toSquareJpeg(file: File, crop?: Crop, size = 600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file couldn't be read as an image"));
      el.src = url;
    });
    const side = crop?.side ?? Math.min(img.naturalWidth, img.naturalHeight);
    const sx = crop?.sx ?? (img.naturalWidth - side) / 2;
    const sy = crop?.sy ?? (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process this image");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process image"))), "image/jpeg", 0.88)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// A profile photo with Upload / Change / Remove: the mentor's (My profile,
// step 1) and the student's optional one (About you). Choosing a photo
// opens "Position your photo" first.
export function ProfilePhoto({
  name,
  photoUrl,
  onChanged,
  hint = "A clear, friendly headshot works best. You can position and zoom it before it's saved.",
}: {
  name: string;
  photoUrl: string | null;
  onChanged: (url: string | null) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function choose(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setMsg("");
    if (!file.type.startsWith("image/")) return setMsg("Please choose an image file (JPG, PNG or WebP).");
    setPicked(file);
  }

  async function upload(file: File, crop: Crop) {
    setBusy(true);
    try {
      const square = await toSquareJpeg(file, crop);
      const form = new FormData();
      form.append("file", new File([square], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/profile/photo", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChanged(data.photoUrl);
      setMsg("Photo updated.");
    } catch (err: any) {
      setMsg(err.message || "Upload failed");
    } finally {
      setPicked(null);
      setBusy(false);
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
        <span className="text-secondary small">{hint}</span>
        <div className="row-wrap">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => choose(e.target.files?.[0])} />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && <button type="button" className="btn btn-sm" disabled={busy} onClick={removePhoto}>Remove</button>}
        </div>
        {msg && <span role="status" className="text-secondary small">{msg}</span>}
      </div>
      {picked && <PhotoCropper file={picked} busy={busy} onCancel={() => !busy && setPicked(null)} onDone={(crop) => upload(picked, crop)} />}
    </div>
  );
}
