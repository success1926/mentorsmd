"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Admin -> Website: the live preview beside the form (wide screens only).
// It shows the page with the saved draft, through the same preview route as
// the Preview button (draft mode + an admin login), so visitors never see it.
// "Computer" renders the page 1280px wide and shrinks it to fit the panel;
// "Phone" renders it 390px wide.

export type EditorPreviewHandle = { reload: () => void };

const WIDTHS = { computer: 1280, phone: 390 } as const;
type Device = keyof typeof WIDTHS;
const DEVICE_KEY = "mmd-site-preview-device";

export const EditorPreview = forwardRef<EditorPreviewHandle, { pageKey: string; path: string; onHide: () => void }>(function EditorPreview(
  { pageKey, path, onHide },
  ref,
) {
  const src = `/api/admin/website/preview?page=${encodeURIComponent(pageKey)}`;
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>("computer");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(DEVICE_KEY) === "phone") setDevice("phone");
    } catch {}
  }, []);
  const pick = (d: Device) => {
    setDevice(d);
    try {
      localStorage.setItem(DEVICE_KEY, d);
    } catch {}
  };

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reload after each autosave, keeping the scroll position. It goes through
  // the preview route again (not a plain reload) so it still shows the draft
  // if preview mode was switched off in another tab.
  useImperativeHandle(ref, () => ({
    reload() {
      const f = frame.current;
      if (!f) return;
      let y = 0;
      try {
        y = f.contentWindow?.scrollY ?? 0;
      } catch {}
      const restore = () => {
        try {
          f.contentWindow?.scrollTo(0, y);
          // The page may still be laying out photos; try once more shortly after.
          window.setTimeout(() => f.contentWindow?.scrollTo(0, y), 250);
        } catch {}
      };
      f.addEventListener("load", restore, { once: true });
      setLoading(true);
      f.src = `${src}&r=${Date.now()}`;
    },
  }));

  const width = WIDTHS[device];
  const scale = box.w ? Math.min(1, (box.w - (device === "phone" ? 24 : 0)) / width) : 1;
  const left = device === "phone" ? Math.max(0, (box.w - width * scale) / 2) : 0;

  return (
    <aside className="ws-preview" aria-label="Live preview of your draft">
      <div className="ws-preview-head">
        <b style={{ fontSize: 14 }}>Preview</b>
        <span className="ws-seg" role="radiogroup" aria-label="Preview width">
          <button type="button" role="radio" aria-checked={device === "computer"} onClick={() => pick("computer")}>Computer</button>
          <button type="button" role="radio" aria-checked={device === "phone"} onClick={() => pick("phone")}>Phone</button>
        </span>
        {loading && <span className="text-muted small">Loading…</span>}
        <span style={{ flex: 1 }} />
        <a className="link small" href={src} target="_blank" rel="noreferrer">Open in a new tab ↗</a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onHide}>Hide</button>
      </div>
      <div ref={stage} className={`ws-preview-stage ws-preview-${device}`}>
        {box.w > 0 && (
          <iframe
            ref={frame}
            title={`Preview of the ${path} page with your draft`}
            src={src}
            onLoad={() => setLoading(false)}
            style={{ width, height: box.h / scale - (device === "phone" ? 24 / scale : 0), transform: `scale(${scale})`, left, top: device === "phone" ? 12 : 0 }}
          />
        )}
      </div>
    </aside>
  );
});
