// The site's own address, for links in emails, Stripe and invites.
// NEXTAUTH_URL when it's set (production: https://mentorsmd.com); on a
// Vercel preview without it, that preview's own address (VERCEL_URL);
// otherwise local development. Never ends with a slash.
export function siteUrl(): string {
  const url = process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}
