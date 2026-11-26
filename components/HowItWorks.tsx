"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { safeHref } from "@/lib/siteContent";
import { focusPosition, stripFocus } from "@/lib/imageFocus";
import { useReveal } from "@/components/Moments";
import { MOMENTS } from "@/lib/moments";
import { Collapsible } from "@/components/ui";

// Homepage "How it works" (Nov 2026, modelled on Leland's "Everything you
// need" block): rows on the left that open one at a time (shared
// <Collapsible variant="row"> with a `name`), and a picture on the right.
// Each row's text, link and picture are edited in Admin -> Website ->
// Homepage. Rows without a photo show a soft card with the row's label and
// short line instead. Closing the open row keeps the last-opened row's
// picture, so the panel never goes blank.

export type HowItem = { title: string; body?: string; cta?: string; href?: string; tag?: string; screen?: string; photo?: string };

export function HowItWorks({ items, footer }: { items: HowItem[]; footer?: React.ReactNode }) {
  // The row whose picture shows: the last one opened (not "the open one").
  const [shown, setShown] = useState(0);
  const name = useId();
  const rowsRef = useRef<HTMLDivElement>(null);
  const [listRef, reveal] = useReveal<HTMLDivElement>("howItWorks"); // moment 8 (lib/moments.ts)

  // "toggle" doesn't bubble, so listen in the capture phase on the list.
  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!d.open) return;
      const i = Number(d.closest<HTMLElement>("[data-how]")?.dataset.how);
      if (Number.isFinite(i)) setShown(i);
    };
    el.addEventListener("toggle", onToggle, true);
    return () => el.removeEventListener("toggle", onToggle, true);
  }, []);

  if (!items.length) return null;
  const idx = Math.min(shown, items.length - 1);
  const current = items[idx];
  return (
    <div className="how-grid">
      <div ref={listRef} className={`how-list${MOMENTS.howItWorks ? " mm-how" : ""}${reveal === "in" ? " mm-in" : ""}`}>
        <div ref={rowsRef}>
          {items.map((it, i) => (
            <div key={i} className="how-row" data-how={i}>
              <Collapsible variant="row" name={name} defaultOpen={i === 0} title={it.title} bodyClassName="how-body">
                {it.body && <p>{it.body}</p>}
                {it.cta && it.href && (
                  <Link href={safeHref(it.href)} className="btn btn-soft btn-sm">
                    {it.cta}
                  </Link>
                )}
              </Collapsible>
            </div>
          ))}
        </div>
        {footer && <div className="how-footer">{footer}</div>}
      </div>
      <div className={`how-panel soft-bg-${idx % 3}`} aria-hidden="true">
        {current?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stripFocus(current.photo)} alt="" loading="lazy" decoding="async" style={{ objectPosition: focusPosition(current.photo) }} />
        ) : (
          current && (
            <div className="how-mock">
              {current.tag && <span className="eyebrow">{current.tag}</span>}
              <b>{current.title}</b>
              {current.screen && <span>{current.screen}</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
