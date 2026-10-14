"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/lib/clientError";

// Shown when a page breaks while it's open in the browser. The error is
// reported to Sentry (when it's set up) without any personal details.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "page");
  }, [error]);
  return (
    <div className="page-narrow">
      <div className="center-head" style={{ padding: "60px 0" }}>
        <h1 className="page-title">Something went wrong on this page.</h1>
        <p className="lede">We&apos;ve been told about it. Please try again, or go back to the home page.</p>
        <div className="row-wrap" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
          <Link href="/" className="btn">Go home</Link>
        </div>
      </div>
    </div>
  );
}
