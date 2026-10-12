import { warnOnce } from "@/lib/warnOnce";
import { fetchWithTimeout } from "@/lib/request";
import { normalize } from "@/lib/moderation";
import { extractLinks, hostOf } from "@/lib/linkText";

export { SHORTENERS, extractLinks, hostOf, isShortener, leavingHref } from "@/lib/linkText";

// Link safety for messages:
//  - link shorteners are refused (they hide where a link really goes)
//  - accounts younger than a day can't send links at all
//  - with GOOGLE_SAFE_BROWSING_KEY set, every link is checked against
//    Google Safe Browsing and known-bad links are refused
//  - links shown in messages open a "You're leaving MentorsMD" page first
//    (app/leaving/page.tsx)

export const NEW_ACCOUNT_LINK_HOURS = 24;

function ownHost(): string | null {
  return hostOf(process.env.NEXTAUTH_URL || "");
}

// Links that point somewhere other than MentorsMD itself.
export function outsideLinks(text: string): string[] {
  const own = ownHost();
  return extractLinks(normalize(text)).filter((l) => {
    const h = hostOf(l);
    return h && h !== own && !(own && h.endsWith(`.${own}`));
  });
}

// Google Safe Browsing (Lookup API v4). Returns the links Google lists as
// malware/phishing. Off (returns []) when the key isn't set or Google
// doesn't answer in time.
export async function unsafeLinks(links: string[]): Promise<string[]> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) {
    warnOnce("safebrowsing", "GOOGLE_SAFE_BROWSING_KEY is not set - links in messages aren't checked against Google Safe Browsing.");
    return [];
  }
  if (!links.length) return [];
  try {
    const res = await fetchWithTimeout(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "mentorsmd", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: links.map((l) => ({ url: /^https?:\/\//i.test(l) ? l : `http://${l}` })),
        },
      }),
    }, 3000);
    if (!res.ok) {
      console.error("Safe Browsing lookup failed:", res.status);
      return [];
    }
    const data: any = await res.json();
    const bad = new Set<string>((data.matches || []).map((m: any) => m.threat?.url).filter(Boolean));
    return links.filter((l) => bad.has(l) || bad.has(`http://${l}`));
  } catch (err) {
    console.error("Safe Browsing lookup failed:", err);
    return [];
  }
}
