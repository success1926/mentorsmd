"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { safeHref } from "@/lib/siteContent";
import { focusPosition, stripFocus } from "@/lib/imageFocus";

// Homepage "How it works" (Nov 2026, modelled on Leland's "Everything you
// need" block): rows on the left that open one at a time with + / −, and a
// picture on the right for the open row. Each row's text, link and
// picture are edited in Admin -> Website -> Homepage. Rows without a
// photo show a soft card with the row's label and short line instead.

export type HowItem = { title: string; body?: string; cta?: string; href?: string; tag?: string; screen?: string; photo?: string };

const PANEL_BGS = [
  "linear-gradient(135deg, #DDD5FF 0%, #F1EDFF 100%)",
  "linear-gradient(135deg, #FCE4EC 0%, #F1EDFF 100%)",
  "linear-gradient(135deg, #E4EEFF 0%, #F1EDFF 100%)",
];

export function HowItWorks({ items, footer }: { items: HowItem[]; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(0);
  const base = useId();
  if (!items.length) return null;
  const current = items[Math.min(open, items.length - 1)];
  return (
    <div className="how-grid">
      <div className="how-list">
        {items.map((it, i) => {
          const isOpen = i === open;
          const id = `${base}-${i}`;
          return (
            <div key={i} className={`how-row${isOpen ? " is-open" : ""}`}>
              <h3>
                <button type="button" className="how-head" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? -1 : i)}>
                  <span>{it.title}</span>
                  <span className="how-sign" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </button>
              </h3>
              <div id={id} className="how-body" hidden={!isOpen}>
                {it.body && <p>{it.body}</p>}
                {it.cta && it.href && (
                  <Link href={safeHref(it.href)} className="btn btn-soft btn-sm">
                    {it.cta}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {footer && <div className="how-footer">{footer}</div>}
      </div>
      <div className="how-panel" aria-hidden="true" style={{ background: PANEL_BGS[Math.max(0, open) % PANEL_BGS.length] }}>
        {current?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={stripFocus(current.photo)} alt="" style={{ objectPosition: focusPosition(current.photo) }} />
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
