"use client";

import { useReveal } from "@/components/Moments";

// The review cards' grid, drifting in when it scrolls into view (moment 9 in lib/moments.ts).
// `className` adds to the grid (e.g. "wall-grid-rail": a sideways row on phones).
export function RevealWall({ children, className }: { children: React.ReactNode; className?: string }) {
  const [ref, state] = useReveal<HTMLDivElement>("reviewsWall", { hideBelowFold: true });
  return (
    <div ref={ref} className={`wall-grid${className ? ` ${className}` : ""}${state === "rest" ? "" : ` mm-${state}`}`}>
      {children}
    </div>
  );
}
