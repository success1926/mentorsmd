"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/clientError";

// Last resort, when even the site's main layout breaks. It replaces the
// whole page, so it has its own <html> and plain styles. Reported to
// Sentry (when it's set up) without any personal details.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "global");
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "80px 20px", textAlign: "center", color: "#1a1a2e" }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Something went wrong.</h1>
        <p style={{ color: "#555", marginBottom: 24 }}>We&apos;ve been told about it. Please try again in a moment.</p>
        <button onClick={() => reset()} style={{ background: "#5536D6", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 999, fontWeight: 600, cursor: "pointer" }}>
          Try again
        </button>{" "}
        <a href="/" style={{ marginLeft: 12, color: "#5536D6" }}>Go home</a>
      </body>
    </html>
  );
}
