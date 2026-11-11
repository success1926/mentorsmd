import { getSiteContent } from "@/lib/siteContentStore";
import { isSafeImage } from "@/lib/siteContent";
import { stripFocus } from "@/lib/imageFocus";
import { logoKey, type LogoMap } from "@/lib/schoolLogoKey";

// School logos for mentor cards and profiles (Nov 2026): the mentor's own
// school and their "Successful clients at" row. Logos come from Admin ->
// Website -> Site settings: the "School logos for mentor profiles" list,
// plus every logo already in the scrolling strips (so a school's logo only
// needs uploading once). Schools without a logo show a lettered badge
// (components/SchoolLogo.tsx).
export async function getSchoolLogos(): Promise<LogoMap> {
  const s = await getSiteContent("siteSettings");
  const map: LogoMap = {};
  const add = (list: { name?: string; logo?: string }[] | undefined) => {
    for (const item of list || []) {
      const name = item.name?.trim();
      const logo = item.logo?.trim();
      if (!name || !logo || !isSafeImage(logo)) continue;
      const k = logoKey(name);
      if (!map[k]) map[k] = stripFocus(logo);
    }
  };
  // The dedicated list wins over the strips.
  add(s.schoolLogos as any);
  add(s.acceptedSchools as any);
  add(s.mentorSchools as any);
  add(s.trainedAt as any);
  return map;
}
