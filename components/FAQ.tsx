"use client";

import { useState } from "react";

// Placeholder questions - swap these for whatever people actually ask you.
const faqs = [
  {
    q: "How are coaches vetted?",
    a: "Coaches can't sign up on their own - every profile is personally reviewed and invited by us before they can publish any packages.",
  },
  {
    q: "How does payment work?",
    a: "You pay securely through the site when you book. That payment is held until you confirm the work is done, then it's released to your coach automatically.",
  },
  {
    q: "What if I'm not satisfied with the work?",
    a: "Message your coach directly to work it out - since payment isn't released until you confirm completion, you're never on the hook before you're ready.",
  },
  {
    q: "Can I message a coach before booking?",
    a: "Yes - in fact you have to. We require you to message a coach and get a reply before you can pick a due date and pay, so you know upfront they can take the work.",
  },
  {
    q: "Do video calls happen on this site?",
    a: "Yes, video calls start right from your order page - no need to schedule through a separate app.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, textAlign: "center", marginBottom: 24 }}>Frequently asked questions</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {faqs.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  color: "#16211A",
                  padding: "16px 18px",
                  fontSize: 15,
                  fontWeight: 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {item.q}
                <span style={{ color: "#6B7A70", fontSize: 20, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.15s" }}>
                  +
                </span>
              </button>
              {isOpen && (
                <p className="text-secondary" style={{ padding: "0 18px 18px", lineHeight: 1.6, margin: 0 }}>
                  {item.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
