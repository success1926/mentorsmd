/** @type {import('next').NextConfig} */
const nextConfig = {
  // reCAPTCHA's site key is public by design; RECAPTCHA_SITE_KEY is
  // accepted as well so either name works in Vercel.
  // Lets instrumentation.ts run at server start (Sentry error reporting).
  experimental: { instrumentationHook: true },
  env: {
    NEXT_PUBLIC_RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || "",
  },
  // Old page addresses keep working (links in old emails, bookmarks,
  // shared profiles). Query strings like ?code=... carry over automatically.
  async redirects() {
    return [
      { source: "/coaches", destination: "/mentors", permanent: true },
      { source: "/coaches/:id", destination: "/mentors/:id", permanent: true },
      { source: "/onboard-coach", destination: "/become-a-mentor/join", permanent: true },
      { source: "/signup/buyer", destination: "/signup", permanent: true },
    ];
  },
};

module.exports = nextConfig;
