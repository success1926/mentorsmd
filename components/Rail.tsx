"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A row of cards that scrolls sideways (trackpad, swipe, shift + wheel), with
// round ‹ › buttons that move it about one card at a time and grey out at
// either end (as on AdmitMD's review carousel). The buttons hide when
// everything already fits, and a soft fade on an edge shows there's more.
// `className` styles the track (e.g. "pkg-row"); `label` names the list for
// screen readers.
export function Rail({ className, label, children, arrowsOnPhones = true }: { className: string; label: string; children: React.ReactNode; arrowsOnPhones?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
    };
  }, [update]);

  function slide(dir: number) {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.getBoundingClientRect().width + 14 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const fits = ends.start && ends.end;
  return (
    <div className={`rail${ends.start ? "" : " rail-more-left"}${ends.end ? "" : " rail-more-right"}`}>
      <div ref={track} className={`${className} rail-track`} role="list" aria-label={`${label} (scroll sideways for more)`} tabIndex={fits ? -1 : 0} onScroll={update}>
        {children}
      </div>
      {!fits && (
        <div className={`rail-arrows${arrowsOnPhones ? "" : " hide-mobile"}`}>
          <button type="button" className="rail-arrow" aria-label={`Scroll ${label.toLowerCase()} left`} disabled={ends.start} onClick={() => slide(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="rail-arrow" aria-label={`Scroll ${label.toLowerCase()} right`} disabled={ends.end} onClick={() => slide(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
