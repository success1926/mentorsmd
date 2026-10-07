// Runs once when the server starts. Hooks server errors up to Sentry
// when SENTRY_DSN is set (see lib/sentry.ts). Nothing happens without it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    const { captureConsoleErrors } = await import("./lib/sentry");
    captureConsoleErrors();
  }
}
