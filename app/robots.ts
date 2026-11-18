import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

// /robots.txt (Nov 2026): public pages are open to search engines; signed-in
// areas, admin, the API and private links (gift pages, invites) are not.
// Preview deployments ask search engines to stay out entirely.
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin", "/api/", "/dashboard", "/account", "/orders", "/messages", "/calendar", "/calls",
        "/credit", "/receipts", "/about-you", "/gift/", "/become-a-mentor/join", "/join-team",
        "/parent", "/consent", "/leaving", "/two-step", "/verify-email", "/waitlist/", "/forgot-password", "/reset-password",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
