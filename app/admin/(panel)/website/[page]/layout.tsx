import { SITE_PAGES, isSitePageKey } from "@/lib/siteContent";

// The browser tab shows which page is being edited ("Homepage | MentorsMD Admin").
export function generateMetadata({ params }: { params: { page: string } }) {
  return { title: isSitePageKey(params.page) ? SITE_PAGES[params.page].label : "Website" };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
