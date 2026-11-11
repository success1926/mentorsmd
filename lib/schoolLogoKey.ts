// Shared by the server (lib/schoolLogos.ts) and the browser
// (components/SchoolLogo.tsx); no server-only imports.

// School name -> logo address.
export type LogoMap = Record<string, string>;

// Names match ignoring case, punctuation and extra spaces.
export const logoKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const logoFor = (logos: LogoMap | null | undefined, name: string | null | undefined) => (logos && name ? logos[logoKey(name)] || "" : "");

// "Boston College" -> "BC", "Duke University School of Medicine" -> "DU",
// "University of Michigan Medical School" -> "UM".
const SKIP = new Set(["of", "the", "and", "at", "for", "in", "&"]);
export function schoolInitials(name: string) {
  const words = name.replace(/[^A-Za-z0-9&\s-]/g, " ").split(/[\s-]+/).filter((w) => w && !SKIP.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
