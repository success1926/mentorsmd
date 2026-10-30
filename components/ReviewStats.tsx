"use client";

import { CountText, useCountUp } from "@/components/CountUp";

// "★★★★★ 12 reviews | 4.9 avg" under the homepage search box; the numbers
// count up from zero the first time they come into view.
export function ReviewStats({ count, avg }: { count: number; avg: number }) {
  const [ref, t] = useCountUp<HTMLDivElement>();
  return (
    <div ref={ref} style={{ fontSize: 18 }}>
      <span className="stars">★★★★★</span>{" "}
      <b>
        <CountText text={String(count)} t={t} /> reviews
      </b>{" "}
      <span style={{ opacity: 0.5 }}>|</span>{" "}
      <span className="text-secondary" style={{ fontSize: 18 }}>
        <CountText text={avg.toFixed(1)} t={t} /> avg
      </span>
    </div>
  );
}
