import { unstable_cache } from "next/cache";

// Public data (mentor cards, mentor profiles, reviews) is the same for every
// visitor, so it's read from the database at most once a minute and shared
// through Next.js's data cache, instead of once per visitor. A rush of
// visitors (a shared link, a social post) then costs about one set of
// database reads a minute. Changes show up on the public pages within a
// minute; a mentor looking at their own profile always sees it fresh.
//
// The cache stores JSON, so dates come back as text: use toDate on them.
export const PUBLIC_CACHE_SECONDS = 60;
export const PUBLIC_DATA_TAG = "public-data";

export function publicCache<A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>) {
  return unstable_cache(fn, [key], { revalidate: PUBLIC_CACHE_SECONDS, tags: [PUBLIC_DATA_TAG] });
}

export function toDate(d: Date | string): Date;
export function toDate(d: Date | string | null): Date | null;
export function toDate(d: Date | string | null) {
  return d === null ? null : new Date(d);
}
