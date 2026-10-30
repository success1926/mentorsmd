"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

// Numbers that count up from zero the first time they scroll into view (review stats on
// the homepage and mentor profiles; copied from AdmitMD).
// Skipped for people who prefer less motion; before scripts run the real numbers show.

const NUM = /\d[\d,]*(?:\.\d+)?/g;

// "$298K–$408K" at 40% → "$119K–$163K": every number in the text scales, everything else stays.
function countText(text: string, t: number) {
  if (t >= 1) return text;
  return text.replace(NUM, (m) => {
    const decimals = m.includes(".") ? m.split(".")[1].length : 0;
    const v = parseFloat(m.replace(/,/g, "")) * t;
    const out = v.toFixed(decimals);
    return m.includes(",") ? Number(out).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : out;
  });
}

// Returns a ref for the element to watch and t (0 → 1) for how far the count has run.
export function useCountUp<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const grid = useRef<T>(null);
  const [t, setT] = useState(1);

  useEffect(() => {
    const el = grid.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setT(0);
    let frame = 0;
    let safety = 0;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      cleanup();
      const t0 = performance.now();
      const run = (now: number) => {
        const p = Math.min(1, (now - t0) / 1100);
        setT(1 - Math.pow(1 - p, 3)); // fast start, gentle finish
        if (p < 1) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
      // If animation frames are paused (e.g. a background tab), still land on the real numbers.
      safety = window.setTimeout(() => setT(1), 1500);
    };
    // Start once a quarter of the way into view: checked on scroll (and by IntersectionObserver where available).
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.85 && r.bottom > 0) start();
    };
    const io = "IntersectionObserver" in window ? new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && start(), { threshold: 0.25 }) : null;
    io?.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    function cleanup() {
      io?.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    }
    check();
    return () => {
      cleanup();
      cancelAnimationFrame(frame);
      clearTimeout(safety);
    };
  }, []);

  return [grid, t];
}

// A number that counts up: shows the animated text, while screen readers get the real value.
export function CountText({ text, t }: { text: string; t: number }) {
  return (
    <>
      <span aria-hidden="true">{countText(text, t)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
