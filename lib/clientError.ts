// Sends a page error from the browser to /api/client-error, which passes
// it on to Sentry (only when SENTRY_DSN is set). Only the page address
// (no query string), the kind of error and Next's digest code are sent,
// never the error message. Never throws.
export function reportClientError(error: (Error & { digest?: string }) | null | undefined, where: "page" | "global") {
  try {
    const body = JSON.stringify({
      path: window.location.pathname,
      name: error?.name || "Error",
      digest: error?.digest,
      where,
    });
    fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // ignore
  }
}
