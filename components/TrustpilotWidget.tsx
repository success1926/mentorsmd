"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// Uses Trustpilot's official "TrustBox" widget - a free embed that pulls
// your live rating and review count directly from Trustpilot's servers,
// so it's never out of date on your end. Requires a free Trustpilot
// Business account (see README for the signup + setup steps) to get your
// businessUnitId and the review-page URL to link out to.
export function TrustpilotWidget() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If the Trustpilot script already loaded before this component
    // mounted (e.g. navigating back to the homepage client-side), this
    // manually re-initializes the widget in this element.
    // @ts-ignore - Trustpilot attaches this to window itself
    if (ref.current && window.Trustpilot) {
      // @ts-ignore
      window.Trustpilot.loadFromElement(ref.current, true);
    }
  }, []);

  const businessUnitId = process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_ID;
  const reviewUrl = process.env.NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL || "https://www.trustpilot.com";

  if (!businessUnitId) return null; // renders nothing until you've set up Trustpilot

  return (
    <>
      <Script
        src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js"
        strategy="afterInteractive"
      />
      <div
        ref={ref}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id="5419b6ffb0d04a076446a9af" // Trustpilot's "Mini" template: stars + review count
        data-businessunit-id={businessUnitId}
        data-style-height="24px"
        data-style-width="100%"
      >
        <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
          See our reviews on Trustpilot
        </a>
      </div>
    </>
  );
}
