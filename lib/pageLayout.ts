// Admin -> Website -> (page) -> Layout: the sections of each editable page,
// in their built-in order. The owner can move them, hide them, change the
// space above them and add extra sections (text, photo with text, FAQ,
// call-to-action banner, video, logo strip).
//
// The layout is saved inside the page's SiteContent JSON under "layout"
// (no separate table). Checking and resolving it lives in lib/siteContent.ts
// (checkLayout); the public pages render it with
// components/website/PageSections.tsx. With nothing saved, every page shows
// its sections in exactly today's order.
//
// The ids below must match the `sections` map in each page's code. `fields`
// lists the page's own fields (lib/siteContent.ts) edited in that section,
// so the editor can group them and the site's Edit buttons can jump there.
// `editOn` sends the edit to another page's editor (e.g. How it works shows
// the vetting panel and questions from the Homepage).
//
// This file has no server-only code and imports only types, so the admin
// form can use it too.

import type { FieldDef } from "@/lib/siteContent";

export type Space = "less" | "more" | "most";
export const SPACES: Space[] = ["less", "more", "most"];
export const SPACE_OPTIONS: { id: "" | Space; label: string }[] = [
  { id: "", label: "Normal space above" },
  { id: "less", label: "Less space above" },
  { id: "more", label: "More space above" },
  { id: "most", label: "Much more space above" },
];

export type AddonType = "text" | "mediaText" | "faq" | "cta" | "video" | "logos";
export type LayoutItem = { id: string; type?: AddonType; hidden?: boolean; space?: Space; data?: Record<string, any> };
// keepVisible: can be moved but not hidden (other pages link to it).
export type BuiltinSection = { id: string; label: string; fields: string[]; editOn?: { page: string; section: string; label: string }; keepVisible?: boolean };

const HOME_FIELDS = {
  hero: ["heroTitle", "heroSub", "searchPlaceholder", "quickTopics", "schoolsLabel", "schools"],
  vetting: ["vetTitle", "vetText", "vetLink", "vetPhoto", "vetItems"],
  faq: ["faqTitle", "faq"],
};

export const PAGE_SECTIONS: Record<string, BuiltinSection[]> = {
  home: [
    { id: "hero", label: "Top of the page (headline, search, schools)", fields: HOME_FIELDS.hero },
    { id: "paths", label: "Getting into med school is hard", fields: ["pathsTitle", "pathsText", "paths"] },
    { id: "vetting", label: "Every mentor, vetted", fields: HOME_FIELDS.vetting },
    { id: "featured", label: "Featured mentors", fields: ["featuredTitle", "featuredLink"] },
    { id: "features", label: "Everything you need to get in", fields: ["featuresTitle", "features"] },
    { id: "testimonials", label: "Testimonials", fields: ["testimonialsEyebrow", "testimonialsTitle", "testimonials"] },
    { id: "faq", label: "Frequently asked questions", fields: HOME_FIELDS.faq },
    { id: "cta", label: "Final call to action", fields: ["ctaTitle", "ctaText", "ctaButton"] },
  ],
  howItWorks: [
    { id: "intro", label: "Intro", fields: ["title", "intro"] },
    { id: "steps", label: "Steps", fields: ["stepsTitle", "steps"] },
    { id: "vetting", label: "Every mentor, vetted", fields: [], editOn: { page: "home", section: "vetting", label: "Homepage" } },
    { id: "protection", label: "Payment protection & safety", fields: ["protectTitle", "protectText", "protectItems"] },
    { id: "faq", label: "Frequently asked questions", fields: [], editOn: { page: "home", section: "faq", label: "Homepage" } },
    { id: "cta", label: "Final call to action", fields: ["ctaTitle", "ctaText"] },
  ],
  seniorTeam: [
    { id: "intro", label: "Intro", fields: ["title", "intro"] },
    { id: "people", label: "People", fields: ["people"] },
    { id: "cta", label: "Bottom box", fields: ["ctaTitle", "ctaText", "ctaButton"] },
  ],
  becomeMentor: [
    { id: "intro", label: "Intro", fields: ["title", "intro", "applyButton"] },
    { id: "perks", label: "Perks", fields: ["perks"] },
    { id: "how", label: "How to join", fields: ["howTitle", "steps", "inviteNote"] },
    { id: "apply", label: "Application form", fields: ["applyTitle", "applyText"], keepVisible: true },
  ],
  reviews: [
    { id: "intro", label: "Intro", fields: ["title", "intro"] },
    { id: "wall", label: "Reviews (or the “no reviews yet” box)", fields: ["emptyTitle", "emptyText"] },
  ],
  contact: [
    { id: "intro", label: "Intro", fields: ["title", "intro", "mentorTitle", "mentorIntro"] },
    { id: "details", label: "Email and phone", fields: ["email", "phone"] },
    { id: "form", label: "Message form", fields: ["formTitle", "formIntro", "formSuccess"] },
    { id: "orderBox", label: "Problem with an order? box", fields: ["orderTitle", "orderText"] },
    { id: "mentorBox", label: "Want to become a mentor? box", fields: ["mentorBoxTitle", "mentorBoxBefore", "mentorBoxLink", "mentorBoxAfter"] },
  ],
};

export const sectionsFor = (page: string): BuiltinSection[] => (Object.prototype.hasOwnProperty.call(PAGE_SECTIONS, page) ? PAGE_SECTIONS[page] : []);
export const hasLayout = (page: string) => sectionsFor(page).length > 0;
export const defaultLayout = (page: string): LayoutItem[] => sectionsFor(page).map((s) => ({ id: s.id }));

// Added sections: at most this many per page; ids look like "x-k3j9a2".
export const MAX_ADDONS = 20;
export const ADDON_ID = /^x-[a-z0-9]{4,16}$/;
export const newAddonId = () => `x-${Math.random().toString(36).slice(2, 10).padEnd(6, "0")}`;

// ---- added section types ----------------------------------------------------
// Their fields use the same types (and the same checks) as the page fields.
const t = (label: string, max: number, help?: string): FieldDef => ({ type: "text", label, default: "", max, help });
const lt = (label: string, max: number, help?: string): FieldDef => ({ type: "longtext", label, default: "", max, help });
const ln = (label: string, help?: string): FieldDef => ({ type: "link", label, default: "", max: 500, help });
const img = (label: string, help?: string): FieldDef => ({ type: "image", label, default: "", max: 600, help });

export const ADDON_TYPES: Record<AddonType, { label: string; help: string; fields: Record<string, FieldDef> }> = {
  text: {
    label: "Text",
    help: "A heading and a few paragraphs.",
    fields: { title: t("Heading", 120), body: lt("Text", 4000, "Each line break starts a new paragraph.") },
  },
  mediaText: {
    label: "Photo with text",
    help: "A photo beside a heading, text and an optional button.",
    fields: {
      image: img("Photo"),
      side: { type: "choice", label: "Photo side", default: "left", max: 10, options: [{ value: "left", label: "Photo on the left" }, { value: "right", label: "Photo on the right" }] },
      title: t("Heading", 120),
      body: lt("Text", 2000, "Each line break starts a new paragraph."),
      buttonLabel: t("Button label (optional)", 40),
      buttonHref: ln("Button opens", "A page on this site (/mentors) or a full https:// address."),
    },
  },
  faq: {
    label: "Questions (FAQ)",
    help: "Questions that open to show the answer.",
    fields: {
      title: t("Heading", 120),
      items: {
        type: "list",
        label: "Questions",
        itemLabel: "Question",
        fields: { question: t("Question", 200), answer: lt("Answer", 1500) },
        default: [],
        maxItems: 20,
      },
    },
  },
  cta: {
    label: "Call-to-action banner",
    help: "A coloured banner with a heading, text and a button.",
    fields: {
      title: t("Heading", 120),
      text: lt("Text", 400),
      buttonLabel: t("Button label", 40),
      buttonHref: ln("Button opens", "A page on this site (/mentors) or a full https:// address."),
    },
  },
  video: {
    label: "Video (YouTube or Vimeo)",
    help: "Paste a YouTube or Vimeo link. Only those two sites are allowed.",
    fields: {
      title: t("Heading (optional)", 120),
      url: ln("YouTube or Vimeo link", "For example https://www.youtube.com/watch?v=… or https://vimeo.com/…"),
      caption: lt("Text under the video (optional)", 400),
    },
  },
  logos: {
    label: "Logo strip",
    help: "A row of logos, e.g. schools or partners.",
    fields: {
      label: t("Small label above (optional)", 80),
      logos: {
        type: "list",
        label: "Logos",
        itemLabel: "Logo",
        fields: { image: img("Logo"), name: t("Name (read aloud by screen readers)", 80) },
        default: [],
        maxItems: 16,
      },
    },
  },
};
export const isAddonType = (x: unknown): x is AddonType => typeof x === "string" && Object.prototype.hasOwnProperty.call(ADDON_TYPES, x);

// The section's name in the editor and on the Edit buttons.
export function sectionLabel(page: string, item: Pick<LayoutItem, "id" | "type">): string {
  const b = sectionsFor(page).find((s) => s.id === item.id);
  if (b) return b.label;
  return item.type && isAddonType(item.type) ? ADDON_TYPES[item.type].label : "Section";
}

// ---- video links ----------------------------------------------------------
// Only YouTube and Vimeo, turned into their privacy-friendly player
// addresses (youtube-nocookie.com; Vimeo with "do not track").
export function videoEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const yt = /^[A-Za-z0-9_-]{11}$/;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    let id = "";
    if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
    else {
      const m = /^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(u.pathname);
      if (m) id = m[1];
    }
    return yt.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).replace(/\/$/, "");
    return yt.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /^\/(?:video\/)?(\d{1,12})(?:\/([0-9a-f]{6,20}))?\/?$/.exec(u.pathname);
    if (!m) return null;
    const hash = m[2] || u.searchParams.get("h") || "";
    return `https://player.vimeo.com/video/${m[1]}?dnt=1${/^[0-9a-f]{6,20}$/.test(hash) ? `&h=${hash}` : ""}`;
  }
  return null;
}
