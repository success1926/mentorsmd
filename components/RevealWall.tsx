"use client";

import { useReveal } from "@/components/Moments";

// The review cards' grid, drifting in when it scrolls into view (moment 9 in lib/moments.ts).
export function RevealWall({ children }: { children: React.ReactNode }) {
  const [ref, state] = useReveal<HTMLDivElement>("reviewsWall", { hideBelowFold: true });
  return (
    <div ref={ref} className={`wall-grid${state === "rest" ? "" : ` mm-${state}`}`}>
      {children}
    </div>
  );
}
