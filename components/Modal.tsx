"use client";

import { useEffect, useRef } from "react";

// A simple accessible pop-up: dims the page, closes on Esc or a click
// outside, and keeps keyboard focus inside while open.
export function Modal({ open, onClose, label, children, dismissable = true }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode; dismissable?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
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

  if (!open) return null;
  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div ref={boxRef} className="modal" role="dialog" aria-modal="true" aria-label={label}>
        {dismissable && (
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
