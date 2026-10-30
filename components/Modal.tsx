"use client";

import { useEffect, useRef, useState } from "react";

// A simple accessible pop-up: dims the page, closes on Esc or a click
// outside, and keeps keyboard focus inside while open.
// `wide`: a larger pop-up (package details).
// `booker`: wider still, for picking a call time (components/Booker.tsx);
// a full-screen sheet on phones.
// While more of a long pop-up is below, a "Scroll" pill shows at the bottom
// (as in AdmitMD's bio pop-ups); it goes once the reader nears the end.
// `resetKey`: when it changes (Previous / Next between bios) the pop-up
// starts back at the top.
export function Modal({ open, onClose, label, children, dismissable = true, wide = false, booker = false, resetKey }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode; dismissable?: boolean; wide?: boolean; booker?: boolean; resetKey?: unknown }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  // Kept in a ref so re-renders (typing in a field) don't re-run the
  // open/focus effect below.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    const focusables = () => Array.from(box?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || []).filter((el) => !el.hasAttribute("disabled"));
    // Focus the first field (or button) when it opens.
    const first = box?.querySelector<HTMLElement>("input, select, textarea") || focusables()[0];
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissable) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const els = focusables();
        if (!els.length) return;
        const firstEl = els[0];
        const lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, dismissable]);

  // Back to the top for each new bio, then check whether there's more below.
  useEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    if (!box) return;
    box.scrollTo?.({ top: 0 });
    const check = () => setMore(box.scrollHeight - box.clientHeight - box.scrollTop > 40);
    check();
    const t = setTimeout(check, 300); // after photos load
    box.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    if (ro) Array.from(box.children).forEach((c) => ro.observe(c));
    return () => {
      clearTimeout(t);
      box.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      ro?.disconnect();
    };
  }, [open, resetKey]);

  if (!open) return null;
  return (
    <div className={`modal-scrim${booker ? " modal-scrim-sheet" : ""}`} onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className={`modal${wide ? " modal-wide" : ""}${booker ? " modal-booker" : ""}`} role="dialog" aria-modal="true" aria-label={label}>
        {dismissable && (
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        )}
        {children}
        {more && (
          <div className="scroll-pill-wrap" aria-hidden="true">
            <span className="scroll-pill">
              Scroll
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
