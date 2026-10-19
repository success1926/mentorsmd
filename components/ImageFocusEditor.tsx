"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload";
import { focusPosition, parseFocus, stripFocus, withFocus } from "@/lib/imageFocus";

// Upload a photo to public-media and click on it to set the focus point
// (the part that stays in view when the photo is cropped). The focus point
// is saved on the address itself (lib/imageFocus.ts). Used by Admin ->
// Website and by mentors for package cover photos.
export function ImageFocusEditor({
  value,
  onChange,
  uploadEndpoint,
  maxMb = 8,
  types = ["jpeg", "png", "webp", "avif"],
  crops = [
    { w: 80, h: 100 },
    { w: 120, h: 120 },
    { w: 180, h: 100 },
  ],
}: {
  value: string;
  onChange: (v: string) => void;
  uploadEndpoint: string;
  maxMb?: number;
  types?: string[];
  crops?: { w: number; h: number }[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const src = stripFocus(value);
  const focus = parseFocus(value);
  const typeNames = types.map((t) => (t === "jpeg" ? "JPG" : t === "webp" ? "WebP" : t.toUpperCase()));
  const typeList = typeNames.length > 1 ? `${typeNames.slice(0, -1).join(", ")} or ${typeNames[typeNames.length - 1]}` : typeNames[0];

  async function pick(file: File) {
    setError("");
    if (!new RegExp(`^image/(${types.join("|")})$`).test(file.type)) return setError(`Please choose a ${typeList} photo.`);
    if (file.size > maxMb * 1024 * 1024) return setError(`That photo is over ${maxMb}MB. Please choose a smaller one.`);
    setUploading(true);
    try {
      const up = await uploadFile(uploadEndpoint, file);
      if (!up.publicUrl) throw new Error("Upload failed. Please try again.");
      onChange(up.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    }
    setUploading(false);
  }

  function setFocus(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    onChange(withFocus(src, { x, y }));
  }

  return (
    <div className="stack-sm" style={{ gap: 10 }}>
      {src ? (
        <div className="row-wrap" style={{ gap: 16, alignItems: "flex-start" }}>
          <div className="stack-sm" style={{ gap: 4 }}>
            <div onClick={setFocus} style={{ position: "relative", cursor: "crosshair", maxWidth: 360, lineHeight: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)" }} title="Click the most important part of the photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: 280, width: "auto", height: "auto", display: "block" }} />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${focus?.x ?? 50}%`,
                  top: `${focus?.y ?? 50}%`,
                  width: 22,
                  height: 22,
                  marginLeft: -11,
                  marginTop: -11,
                  borderRadius: 999,
                  border: "3px solid #fff",
                  background: "rgba(85,54,214,0.75)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
                  opacity: focus ? 1 : 0.5,
                }}
              />
            </div>
            <span className="field-help">Click the most important part (e.g. a face). It stays in view when the photo is cropped.</span>
          </div>
          <div className="stack-sm" style={{ gap: 6 }}>
            <span className="field-help">How it crops:</span>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {crops.map((b, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" style={{ width: b.w, height: b.h, objectFit: "cover", objectPosition: focusPosition(value), borderRadius: 8, border: "1px solid var(--line)" }} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <span className="text-muted small">No photo.</span>
      )}
      <div className="row-wrap" style={{ gap: 8 }}>
        <input ref={input} type="file" accept={types.map((t) => `image/${t}`).join(",")} hidden onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        <button type="button" className="btn btn-soft" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? "Uploading…" : src ? "Replace photo" : "Upload photo"}
        </button>
        {src && focus && <button type="button" className="btn" onClick={() => onChange(src)}>Clear focus point</button>}
        {src && <button type="button" className="btn" style={{ color: "var(--danger)" }} onClick={() => onChange("")}>Remove photo</button>}
      </div>
      <span className="field-help">{typeList}, up to {maxMb}MB.</span>
      {error && <span className="field-help" style={{ color: "var(--danger)" }}>{error}</span>}
    </div>
  );
}
