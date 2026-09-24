// Protects /api/cron/* so only Vercel's scheduler can trigger them.
// Previously, if CRON_SECRET was missing from the environment, the check
// compared against "Bearer undefined" - which anyone could send.
export function isAuthorizedCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set - refusing to run cron job");
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
