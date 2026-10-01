"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    title: "Work 1-on-1 with a vetted mentor",
    body: "Message any mentor for free, then book help with one specific task, on your timeline.",
    cta: "Browse mentors",
    href: "/coaches",
    tag: "MESSAGING",
    screen: "Message a mentor, ask questions, and book once they reply.",
  },
  {
    title: "Get your essays reviewed",
    body: "Personal statements, activities and secondaries, with line edits and written feedback from someone who wrote winning ones.",
    cta: "Find an essay mentor",
    href: "/coaches?service=PERSONAL_STATEMENT&service=SECONDARIES&service=ACTIVITIES",
    tag: "ESSAY REVIEW",
    screen: "Line edits and written feedback, delivered on your due date.",
  },
  {
    title: "Practice your interviews",
    body: "MMI and traditional mock interviews over video, with written feedback after every session. Book the call on your mentor's calendar once you've paid.",
    cta: "Book a mock interview",
    href: "/coaches?service=MMI&service=TRADITIONAL_INTERVIEW",
    tag: "MOCK MMI",
    screen: "Pick a time on your mentor's calendar and join from your order.",
  },
  {
    title: "Payment held until you approve",
    body: "You pay when you book, and MentorsMD holds the payment, not the mentor. It is released when you approve the work, or automatically 96 hours after it is delivered.",
    cta: "Get started",
    href: "/signup/buyer",
    tag: "PAYMENT HELD",
    screen: "Paid → Held by MentorsMD → Delivered → Released",
  },
];

const SWATCHES = ["#FFFFFF", "#F5B9CD", "#E4EEFF", "#F1EDFF", "#FCE4EC", "#CFC4FF"];

export function HomeFeatures() {
  const [open, setOpen] = useState(0);
  const f = FEATURES[open];
  return (
    <div className="features">
      <div>
        <div style={{ borderTop: "1px solid var(--line)" }}>
          {FEATURES.map((item, i) => (
            <div className="acc-item" key={item.title}>
              <button className="acc-btn" aria-expanded={open === i} onClick={() => setOpen(i)}>
                {item.title}
                <span aria-hidden="true">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && (
                <div className="acc-body">
                  <p>{item.body}</p>
                  <Link href={item.href} className="btn btn-soft" style={{ alignSelf: "flex-start", padding: "14px 24px" }}>
                    {item.cta}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
        <Link href="/coaches" className="btn btn-primary btn-lg" style={{ marginTop: 40 }}>
          Get started
        </Link>
      </div>
      <div className="feature-media" aria-hidden="true">
        <div className="feature-screen">
          <span className="feature-tag">{f.tag}</span>
          <span className="display" style={{ fontSize: 28, maxWidth: 420, lineHeight: 1.2 }}>{f.screen}</span>
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
