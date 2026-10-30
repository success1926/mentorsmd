"use client";

import { useEffect, useState } from "react";

// The small "Scroll" hint at the bottom of the full-screen homepage hero
// (as on AdmitMD's opening). It fades away once the visitor starts scrolling;
// clicking it glides down to the next section.
export function ScrollCue() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function next(e: React.MouseEvent<HTMLButtonElement>) {
    const hero = e.currentTarget.closest("section");
    const top = hero ? hero.getBoundingClientRect().bottom + window.scrollY - 72 : window.innerHeight;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <button type="button" className={`hero-scroll-cue${hidden ? " is-hidden" : ""}`} onClick={next} tabIndex={hidden ? -1 : 0}>
      Scroll
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
