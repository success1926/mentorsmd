// Where visitors come from, for Admin -> Insights (#83, #86).
//
// On the first visit, components/Tracker.tsx stores two first-party
// cookies (no outside service, no IP address):
//   mmd_vid  a random visitor id, so visits/searches/profile views from
//            the same browser can be counted once
//   mmd_src  how the visitor first arrived: "<source>|<detail>", e.g.
//            "google|google.com /mentors", "instagram|spring-campaign /",
//            "direct|/". The source comes from ?utm_source=..., or the
//            referring website, or "direct".
// At signup the source is copied onto the account (User.signupSource).
// Safe to import from client and server code.

export const VISITOR_COOKIE = "mmd_vid";
export const SOURCE_COOKIE = "mmd_src";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 365; // a year

// Known referring sites, grouped under one readable name.
const KNOWN: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(twitter\.com|x\.com|t\.co)$/, "x"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)studentdoctor\.net$/, "studentdoctor"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "chatgpt"],
];

export function cleanSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || null;
}

function cleanDetail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
  return s || null;
}

// Browser side: works out the source of this visit.
export function sourceFromVisit(href: string, referrer: string): { source: string; detail: string } {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { source: "direct", detail: "/" };
  }
  const path = url.pathname.slice(0, 80);
  const utm = cleanSource(url.searchParams.get("utm_source") || url.searchParams.get("ref"));
  if (utm) {
    const extra = [url.searchParams.get("utm_campaign"), url.searchParams.get("utm_medium")].filter(Boolean).join(" ").slice(0, 80);
    return { source: utm, detail: `${extra ? `${extra} ` : ""}${path}` };
  }
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
      if (host && host !== url.hostname.replace(/^www\./, "").toLowerCase()) {
        const known = KNOWN.find(([re]) => re.test(host));
        return { source: known ? known[1] : "referral", detail: `${host} ${path}` };
      }
    } catch {
      // unreadable referrer: treat as direct
    }
  }
  return { source: "direct", detail: path };
}

export function encodeSourceCookie(v: { source: string; detail: string }) {
  return encodeURIComponent(`${v.source}|${v.detail}`);
}

// Server side: reads the mmd_src cookie value.
export function parseSourceCookie(value: string | undefined | null): { source: string; detail: string | null } | null {
  if (!value) return null;
  let raw = value;
  try {
    raw = decodeURIComponent(value);
  } catch {
    // keep as-is
  }
  const [src, ...rest] = raw.split("|");
  const source = cleanSource(src);
  if (!source) return null;
  return { source, detail: cleanDetail(rest.join("|")) };
}

export function cleanVisitorId(value: string | undefined | null): string | null {
  return value && /^[a-zA-Z0-9_-]{8,64}$/.test(value) ? value : null;
}

// Reads a cookie from a raw Cookie header.
export function cookieFrom(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

// Readable names for the Insights tables.
export function sourceLabel(source: string | null | undefined) {
  if (!source) return "Unknown (before tracking)";
  if (source === "direct") return "Direct (typed or bookmarked)";
  if (source === "referral") return "Another website";
  return source;
}
