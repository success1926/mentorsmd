/** @type {import('next').NextConfig} */
const nextConfig = {
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
