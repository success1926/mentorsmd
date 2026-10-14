"use client";

import { useState } from "react";
import Link from "next/link";
import { RoleCta } from "@/components/RoleCta";

// The items are edited in Admin -> Website (defaults in lib/siteContent.ts)
// and passed in by the homepage.
export type HomeFeature = { title: string; body: string; cta: string; href: string; tag: string; screen: string };

const SWATCHES = ["#FFFFFF", "#F5B9CD", "#E4EEFF", "#F1EDFF", "#FCE4EC", "#CFC4FF"];

export function HomeFeatures({ features }: { features: HomeFeature[] }) {
  const [open, setOpen] = useState(0);
  const f = features[open] ?? features[0];
  return (
    <div className="features">
      <div>
        <div style={{ borderTop: "1px solid var(--line)" }}>
          {features.map((item, i) => (
            <div className="acc-item" key={i}>
              <button className="acc-btn" aria-expanded={open === i} onClick={() => setOpen(i)}>
                {item.title}
                <span aria-hidden="true">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && (
                <div className="acc-body">
                  {item.body && <p>{item.body}</p>}
                  {!item.cta ? null : item.href === "/signup" ? (
                    <RoleCta href={item.href} label={item.cta} className="btn btn-soft" style={{ alignSelf: "flex-start", padding: "14px 24px" }} />
                  ) : (
                    <Link href={item.href} className="btn btn-soft" style={{ alignSelf: "flex-start", padding: "14px 24px" }}>
                      {item.cta}
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <RoleCta href="/mentors" label="Get started" className="btn btn-primary btn-lg" style={{ marginTop: 40 }} />
      </div>
      <div className="feature-media" aria-hidden="true">
        <div className="feature-screen">
          {f?.tag && <span className="feature-tag">{f.tag}</span>}
          {f?.screen && <span className="display" style={{ fontSize: 28, maxWidth: 420, lineHeight: 1.2 }}>{f.screen}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
          {SWATCHES.map((c) => (
            <span key={c} style={{ height: 96, borderRadius: 10, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
