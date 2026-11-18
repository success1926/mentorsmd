import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";
import { parseBrowseFilters, searchMentors } from "@/lib/mentorQueries";

// /sitemap.xml (Nov 2026): the public pages plus every mentor profile that
// shows on Browse Mentors, so Google can find them. Rebuilt at most once an
// hour. If the mentors can't be read, the public pages are still listed.
export const revalidate = 3600;

const PAGES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/mentors", priority: 0.9, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/senior-team", priority: 0.7, changeFrequency: "monthly" },
  { path: "/become-a-mentor", priority: 0.6, changeFrequency: "monthly" },
  { path: "/reviews", priority: 0.6, changeFrequency: "weekly" },
  { path: "/gift", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/safety", priority: 0.4, changeFrequency: "yearly" },
  { path: "/community-guidelines", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/mentor-agreement", priority: 0.2, changeFrequency: "yearly" },
  { path: "/parental-consent", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = PAGES.map((p) => ({ url: `${base}${p.path === "/" ? "" : p.path}`, changeFrequency: p.changeFrequency, priority: p.priority }));
  let mentors: MetadataRoute.Sitemap = [];
  try {
    const list = await searchMentors(parseBrowseFilters({}));
    mentors = list.map((m) => ({ url: `${base}/mentors/${m.id}`, changeFrequency: "weekly" as const, priority: 0.7 }));
  } catch (err) {
    console.error("Sitemap: couldn't load mentors (listing the public pages only):", err);
  }
  return [...pages, ...mentors];
}
