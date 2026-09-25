"use client";

import { useEffect, useRef } from "react";

// The Leland-style "grows as it becomes the main thing on screen" effect.
//
// Sets a CSS variable --p on the wrapper that goes from 0 (the section's
// top edge just entering the bottom of the screen) to 1 (its top edge has
// reached the upper third of the screen). The .scroll-grow CSS in
// globals.css turns that into a scale + fade. Everything above the fold
// starts at full size, so there's no flicker on page load.
//
// Respects the "reduce motion" accessibility setting: people who've
// turned that on just see the page without the effect.
export function ScrollGrow({
  children,
  from = 0.9,
  className = "",
  style,
}: {
  children: React.ReactNode;
  from?: number; // starting scale, e.g. 0.9 = starts at 90% size
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const start = vh; // top edge at the bottom of the screen
      const end = vh * 0.3; // top edge a third of the way down
      const p = Math.min(1, Math.max(0, (start - top) / (start - end)));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={`scroll-grow ${className}`} style={{ ...style, ["--from" as any]: from }}>
      {children}
    </div>
  );
}
