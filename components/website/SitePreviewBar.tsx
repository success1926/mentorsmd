import { isSitePreview, previewPageKey } from "@/lib/siteContentStore";
import { SITE_PAGES } from "@/lib/siteContent";
import { SitePreviewBarClient } from "./SitePreviewBarClient";

// Shown at the top of every page while an admin previews unpublished
// changes from Admin -> Website. Visitors never see it.
export async function SitePreviewBar() {
  if (!(await isSitePreview())) return null;
  const key = previewPageKey();
  return <SitePreviewBarClient pageKey={key} pageLabel={key ? SITE_PAGES[key].label : null} />;
}
