"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

// The "Position your photo" step before a profile photo is uploaded: the
// photo in a square frame (with the round crop shown), drag it to move it,
// the slider (or + / -) to zoom, arrow keys to nudge. The chosen square is
// what gets saved (components/ProfilePhoto.tsx), so every place that shows
// the photo shows it exactly like this.

export type Crop = { sx: number; sy: number; side: number }; // in the photo's own pixels

const FRAME = 280; // px, the square on screen
const MAX_ZOOM = 3;

export function PhotoCropper({ file, onCancel, onDone, busy }: { file: File; onCancel: () => void; onDone: (crop: Crop) => void; busy?: boolean }) {
  const [src, setSrc] = useState("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // the photo's top-left, relative to the frame
  const [error, setError] = useState("");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    const img = new Image();
    img.onload = () => {
      const n = { w: img.naturalWidth, h: img.naturalHeight };
      setNat(n);
      const s = FRAME / Math.min(n.w, n.h);
      setZoom(1);
      setOff({ x: (FRAME - n.w * s) / 2, y: (FRAME - n.h * s) / 2 });
    };
    img.onerror = () => setError("That file couldn't be read as an image.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const scale = nat ? (FRAME / Math.min(nat.w, nat.h)) * zoom : 1;
  const w = nat ? nat.w * scale : FRAME;
  const h = nat ? nat.h * scale : FRAME;
  // The photo always covers the whole frame.
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({
    x: Math.min(0, Math.max(FRAME - ww, p.x)),
    y: Math.min(0, Math.max(FRAME - hh, p.y)),
  });

  function changeZoom(z: number) {
    if (!nat) return;
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    // Keep the middle of the frame on the same spot of the photo.
    const s0 = FRAME / Math.min(nat.w, nat.h);
    const cx = (FRAME / 2 - off.x) / (s0 * zoom);
    const cy = (FRAME / 2 - off.y) / (s0 * zoom);
    const s1 = s0 * next;
    setZoom(next);
    setOff(clamp({ x: FRAME / 2 - cx * s1, y: FRAME / 2 - cy * s1 }, nat.w * s1, nat.h * s1));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOff(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 20 : 6;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      setOff(clamp({ x: off.x + moves[e.key][0], y: off.y + moves[e.key][1] }));
    } else if (e.key === "+" || e.key === "=") changeZoom(zoom + 0.1);
    else if (e.key === "-") changeZoom(zoom - 0.1);
  }

  function done() {
    if (!nat) return;
    onDone({ sx: -off.x / scale, sy: -off.y / scale, side: FRAME / scale });
  }

  return (
    <Modal open onClose={onCancel} label="Position your photo">
      <div className="stack" style={{ gap: 14, alignItems: "center" }}>
        <h2 style={{ fontSize: 24, alignSelf: "flex-start", paddingRight: 36 }}>Position your photo</h2>
        <span className="text-secondary small" style={{ alignSelf: "flex-start" }}>Drag to move it and use the slider to zoom. The circle is how it shows on your profile and in messages.</span>
        {error ? (
          <div role="alert" className="alert alert-danger">{error}</div>
        ) : (
          <div
            role="application"
            aria-label="Photo position. Use the arrow keys to move it, and plus or minus to zoom."
            tabIndex={0}
            className="photo-crop-frame"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={onKeyDown}
          >
            {src && nat && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" draggable={false} style={{ position: "absolute", left: off.x, top: off.y, width: w, height: h, maxWidth: "none" }} />
            )}
            <span className="photo-crop-circle" aria-hidden="true" />
          </div>
        )}
        <label className="row" style={{ gap: 10, width: FRAME }}>
          <span className="small text-secondary">Zoom</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} className="grow" aria-label="Zoom" disabled={!nat} />
        </label>
        <div className="row-wrap" style={{ alignSelf: "flex-start" }}>
          <button type="button" className="btn btn-primary" disabled={!nat || busy} onClick={done}>{busy ? "Saving…" : "Use this photo"}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
