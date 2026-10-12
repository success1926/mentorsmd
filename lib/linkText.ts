// Finding links in text. No server-only code, so the message thread in
// the browser uses the same rules to turn links into safe links.

export const SHORTENERS = [
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "rb.gy", "tiny.cc", "bl.ink", "t.ly", "s.id", "lnkd.in", "shorte.st", "adf.ly", "bit.do", "v.gd",
  "qr.ae", "tr.im", "soo.gd", "x.co", "tiny.one", "short.io", "shorturl.com", "rotf.lol", "u.to", "clck.ru", "urlz.fr",
];

const TLDS = "com|net|org|edu|gov|io|ly|co|me|us|gl|gd|to|link|app|xyz|info|biz|site|online|page|dev|ai|cc|ru|ws|tk|ml|ga|cf|gq|top|click|lol|at|in|id|ae|im|fr|uk|ca";
// Full links (http/https/www) and bare domains like "example.com/path".
const URL_RE = new RegExp(
  `(?<![@\\w.-])((?:https?:\\/\\/|www\\.)[^\\s<>"']+|(?:[a-z0-9-]+\\.)+(?:${TLDS})(?![a-z0-9-])(?:\\/[^\\s<>"']*)?)`,
  "gi"
);

function trimTrailing(url: string) {
  return url.replace(/[).,;:!?\]}'"]+$/, "");
}

export function extractLinks(text: string): string[] {
  if (!text) return [];
  const found = (text.match(URL_RE) || []).map(trimTrailing).filter((u) => u.length > 3);
  return Array.from(new Set(found)).slice(0, 20);
}

export function hostOf(link: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isShortener(link: string) {
  const host = hostOf(link);
  return !!host && SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`));
}

// The "You're leaving MentorsMD" page for a link.
export function leavingHref(link: string) {
  const full = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  return `/leaving?url=${encodeURIComponent(full)}`;
}
