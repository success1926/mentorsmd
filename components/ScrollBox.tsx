"use client";

import { useEffect, useRef, useState } from "react";

// A box that scrolls on its own (the profile's full bio). At its top or
// bottom the mouse wheel goes back to the page so it never feels stuck, and
// a "Scroll" pill shows while more is below (both as on AdmitMD).
export function ScrollBox({ className, label, id, children }: { className: string; label: string; id?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 24);
    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
        e.preventDefault();
        window.scrollBy({ top: dy, behavior: "instant" as ScrollBehavior });
      }
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div className="scroll-box">
      {/* Scrolls on its own, so it's focusable for keyboard scrolling. */}
      <div ref={ref} id={id} className={className} tabIndex={0} role="region" aria-label={label}>
        {children}
      </div>
      {more && (
        <span className="scroll-pill scroll-box-pill" aria-hidden="true">
          Scroll
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      )}
    </div>
  );
}
