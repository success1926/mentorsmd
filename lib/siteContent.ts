// Admin -> Website: every editable piece of text and every photo on the
// public pages, with its built-in default. The defaults ARE today's site:
// with nothing saved in the database (the SiteContent table), every page
// looks exactly as it did before the editor existed.
//
// Field types:
//  - text      one line
//  - longtext  several lines; each line break starts a new paragraph (or
//              a new line in headings)
//  - link      a page on this site ("/mentors?...") or a full https:// address
//  - image     a photo address, with an optional focus point (#fp=x,y)
//  - lines     a simple list, one item per line (schools, tags, steps)
//  - list      a list of cards, each with its own fields (add/remove/reorder)
//
// This file has no server-only code, so the admin form can use it too.
// Loading and saving lives in lib/siteContentStore.ts.

import { MENTOR_SCHOOLS, PHOTOS, SENIOR_TEAM, TESTIMONIALS } from "@/lib/content";
import { parseFocus, stripFocus, withFocus } from "@/lib/imageFocus";

type Base = { label: string; help?: string; section?: string };
export type TextDef = Base & { type: "text" | "longtext"; default: string; max: number; required?: boolean };
export type LinkDef = Base & { type: "link"; default: string; max: number; required?: boolean };
export type ImageDef = Base & { type: "image"; default: string; max: number };
export type LinesDef = Base & { type: "lines"; default: string[]; max: number; maxItems: number };
export type ScalarDef = TextDef | LinkDef | ImageDef | LinesDef;
type ScalarValue<F> = F extends LinesDef ? string[] : string;
export type ItemValue<I extends Record<string, ScalarDef>> = { [K in keyof I]: ScalarValue<I[K]> };
export type ListDef<I extends Record<string, ScalarDef> = Record<string, ScalarDef>> = Base & {
  type: "list";
  itemLabel: string;
  fields: I;
  default: ItemValue<I>[];
  maxItems: number;
};
export type FieldDef = ScalarDef | ListDef<any>;
export type ValueOf<F> = F extends ListDef<infer I extends Record<string, ScalarDef>> ? ItemValue<I>[] : ScalarValue<F>;

// ---- field builders -------------------------------------------------------
type Opts = { help?: string; max?: number; required?: boolean };
const text = (label: string, def: string, o: Opts = {}): TextDef => ({ type: "text", label, default: def, max: o.max ?? 200, help: o.help, required: o.required });
const long = (label: string, def: string, o: Opts = {}): TextDef => ({ type: "longtext", label, default: def, max: o.max ?? 2000, help: o.help, required: o.required });
const link = (label: string, def: string, o: Opts = {}): LinkDef => ({ type: "link", label, default: def, max: 500, help: o.help, required: o.required });
const image = (label: string, def: string, help?: string): ImageDef => ({ type: "image", label, default: def, max: 600, help });
const lines = (label: string, def: string[], o: { help?: string; max?: number; maxItems?: number } = {}): LinesDef => ({
  type: "lines",
  label,
  default: def,
  max: o.max ?? 200,
  maxItems: o.maxItems ?? 30,
  help: o.help,
});
function list<I extends Record<string, ScalarDef>>(label: string, itemLabel: string, fields: I, def: ItemValue<I>[], o: { help?: string; maxItems?: number } = {}): ListDef<I> {
  return { type: "list", label, itemLabel, fields, default: def, maxItems: o.maxItems ?? 30, help: o.help };
}
// Tags a group of fields with the section heading they appear under in the form.
function section<F extends Record<string, FieldDef>>(title: string, fields: F): F {
  for (const f of Object.values(fields)) f.section = title;
  return fields;
}

// "50% 15%" (the old photoPosition) -> a focus point on the address.
function positionToFocus(url: string, pos?: string) {
  const m = /^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec((pos || "").trim());
  return m ? withFocus(url, { x: Number(m[1]), y: Number(m[2]) }) : url;
}

// ---- the pages ------------------------------------------------------------
export const SITE_PAGES = {
  home: {
    label: "Homepage",
    path: "/",
    fields: {
      ...section("Hero (top of the page)", {
        heroTitle: text("Headline", "Your white coat starts here", { required: true }),
        heroSub: long("Text under the headline", "One-on-one help from med students and residents, every one vetted by our senior team.", { max: 400 }),
        searchPlaceholder: text("Search box hint", "Search for help with your personal statement, MMI, MCAT…"),
        quickTopics: list(
          "Quick topic buttons",
          "Button",
          { label: text("Label", "", { max: 40, required: true }), href: link("Opens", "/mentors", { required: true }) },
          [
            { label: "Personal statement", href: "/mentors?service=PERSONAL_STATEMENT" },
            { label: "Secondaries", href: "/mentors?service=SECONDARIES" },
            { label: "Interviews", href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW" },
            { label: "MCAT", href: "/mentors?service=MCAT" },
            { label: "Reapplying", href: "/mentors?service=REAPPLICANT&bg=REAPPLICANT" },
          ],
          { maxItems: 8, help: "Icons follow the order: pen, page, chat, chart, arrows." },
        ),
      }),
      ...section("Our mentors study at", {
        schoolsLabel: text("Label", "Our mentors study at", { max: 60 }),
        schools: lines("Schools", MENTOR_SCHOOLS, { max: 80, maxItems: 20, help: "One school per line. The strip is hidden when the list is empty. Use only schools your current mentors actually attend." }),
      }),
      ...section("“Getting into med school is hard”", {
        pathsTitle: long("Heading", "Getting into med school is hard.\nYou don't have to do it alone.", { max: 200, help: "A line break starts a new line." }),
        pathsText: long("Text", "The process is long, competitive and hard to read from the outside. MentorsMD pairs you with people who got in recently and know what works now.", { max: 600 }),
        paths: list(
          "Path cards",
          "Card",
          {
            title: text("Title", "", { max: 80, required: true }),
            body: long("Text", "", { max: 300 }),
            photo: image("Photo", "", "Optional. Without a photo the card shows the brand colors."),
            button: text("Button label", "Find a mentor", { max: 40 }),
            href: link("Button opens", "/mentors", { required: true }),
          },
          [
            { title: "Write a standout application", body: "Personal statement, activities and secondaries, shaped by someone who just wrote theirs.", photo: PHOTOS.pathApplication, button: "Find a mentor", href: "/mentors?service=PERSONAL_STATEMENT&service=SECONDARIES&service=ACTIVITIES" },
            { title: "Ace your interviews", body: "MMI and traditional mock interviews with written feedback after every session.", photo: PHOTOS.pathInterviews, button: "Find a mentor", href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW" },
            { title: "Plan your path", body: "School lists, MCAT strategy, gap years and reapplying, from people who made the same calls.", photo: PHOTOS.pathPlan, button: "Find a mentor", href: "/mentors?service=SCHOOL_LIST&service=MCAT&service=REAPPLICANT" },
          ],
          { maxItems: 6 },
        ),
      }),
      ...section("“Every mentor, vetted”", {
        vetTitle: text("Heading", "Every mentor, vetted.", { max: 80 }),
        vetText: long("Text", "Anyone can call themselves an admissions coach. On MentorsMD, nobody mentors until they've been through a rigorous interview with each of our senior team members, so every mentor has real experience and outstanding results.", { max: 800 }),
        vetLink: text("Link to the senior team", "Meet our senior team →", { max: 60 }),
        vetPhoto: image("Background photo", PHOTOS.vetting, "Optional. Without a photo the panel shows the brand colors."),
        vetItems: list(
          "Points under the panel",
          "Point",
          { title: text("Title", "", { max: 60, required: true }), body: long("Text", "", { max: 300 }) },
          [
            { title: "Interviewed", body: "Every mentor goes through a rigorous interview with each of our senior team members." },
            { title: "Real experience", body: "We make sure they have real, hands-on experience with what they offer." },
            { title: "Outstanding results", body: "Only mentors with outstanding results of their own are accepted." },
            // Mentors are invite-only, so there's no acceptance rate to show.
            { title: "Invite-only", body: "Nobody can sign up to mentor. Every mentor joins through an invite from our team." },
          ],
          { maxItems: 8, help: "Icons follow the order: chat, page, check mark, star." },
        ),
      }),
      ...section("Featured mentors", {
        featuredTitle: text("Heading", "Meet a few of our mentors.", { max: 80 }),
        featuredLink: text("Link", "Browse all mentors →", { max: 60 }),
      }),
      ...section("“Everything you need to get in”", {
        featuresTitle: text("Heading", "Everything you need to get in.", { max: 80 }),
        features: list(
          "Items",
          "Item",
          {
            title: text("Title", "", { max: 80, required: true }),
            body: long("Text", "", { max: 500 }),
            cta: text("Button label", "Browse mentors", { max: 40 }),
            href: link("Button opens", "/mentors", { required: true }),
            tag: text("Label on the picture", "", { max: 30 }),
            screen: text("Text on the picture", "", { max: 120 }),
          },
          [
            { title: "Work 1-on-1 with a vetted mentor", body: "Message any mentor for free, then book help with one specific task, on your timeline.", cta: "Browse mentors", href: "/mentors", tag: "MESSAGING", screen: "Message a mentor, ask questions, and book once they reply." },
            { title: "Get your essays reviewed", body: "Personal statements, activities and secondaries, with line edits and written feedback from someone who wrote winning ones.", cta: "Find an essay mentor", href: "/mentors?service=PERSONAL_STATEMENT&service=SECONDARIES&service=ACTIVITIES", tag: "ESSAY REVIEW", screen: "Line edits and written feedback, delivered on your due date." },
            { title: "Practice your interviews", body: "MMI and traditional mock interviews over video, with written feedback after every session. Book the call on your mentor's calendar once you've paid.", cta: "Book a mock interview", href: "/mentors?service=MMI&service=TRADITIONAL_INTERVIEW", tag: "MOCK MMI", screen: "Pick a time on your mentor's calendar and join from your order." },
            { title: "Payment held until you approve", body: "You pay when you book, and MentorsMD holds the payment, not the mentor. It is released when you approve the work, or automatically 96 hours after it is delivered.", cta: "Get started", href: "/signup", tag: "PAYMENT HELD", screen: "Paid → Held by MentorsMD → Delivered → Released" },
            { title: "Ask for a revision", body: "Not quite right? Ask your mentor for a revision from your order, and the due date moves out 7 days so they have time to rework it.", cta: "Browse mentors", href: "/mentors", tag: "REVISIONS", screen: "Revision requested → New due date, 7 days out" },
            { title: "Help if something goes wrong", body: "Open a dispute from your order and a MentorsMD admin steps in. They look at what happened and can refund your payment.", cta: "Get started", href: "/signup", tag: "DISPUTES", screen: "Dispute opened → MentorsMD admin reviews → Refund if needed" },
          ],
          { maxItems: 10 },
        ),
      }),
      ...section("Testimonials", {
        testimonialsEyebrow: text("Small label", "Testimonials", { max: 40 }),
        testimonialsTitle: text("Heading", "Don't just take our word for it.", { max: 80 }),
        testimonials: list(
          "Hand-picked testimonials",
          "Testimonial",
          {
            name: text("Name", "", { max: 60, required: true }),
            detail: text("Detail (e.g. Accepted to …)", "", { max: 100 }),
            quote: long("Quote", "", { max: 800, required: true }),
            rating: text("Stars (1–5)", "5", { max: 1 }),
          },
          TESTIMONIALS.map((t) => ({ name: t.name, detail: t.detail, quote: t.quote, rating: String(t.rating ?? 5) })),
          { help: "Only with permission. Real reviews from completed orders are added automatically. The section shows once there are at least 3 in total." },
        ),
      }),
      ...section("Frequently asked questions", {
        faqTitle: text("Heading", "Questions, answered.", { max: 80 }),
        faq: list(
          "Questions",
          "Question",
          { question: text("Question", "", { max: 200, required: true }), answer: long("Answer", "", { max: 1500, required: true }) },
          [],
          { help: "The section is hidden while there are no questions." },
        ),
      }),
      ...section("Final call to action", {
        ctaTitle: text("Heading", "Ready when you are.", { max: 80 }),
        ctaText: long("Text", "Message any vetted mentor for free. When you book, we hold your payment until you approve the work.", { max: 400 }),
        ctaButton: text("Button label", "Get started", { max: 40 }),
      }),
    },
  },

  seniorTeam: {
    label: "Senior team",
    path: "/senior-team",
    fields: {
      ...section("Intro", {
        title: text("Heading", "Our senior team.", { max: 80 }),
        intro: long("Intro", "Every MentorsMD mentor goes through a rigorous interview with each of us before they're invited, so students know anyone they message has real experience and outstanding results.", { max: 800 }),
      }),
      ...section("People", {
        people: list(
          "People",
          "Person",
          {
            name: text("Name", "", { max: 80, required: true }),
            title: text("Title", "", { max: 100 }),
            creds: text("Credentials (optional)", "", { max: 200 }),
            photo: image("Photo", ""),
            bio: long("Bio", "", { max: 6000, help: "Each line break starts a new paragraph." }),
            focus: lines("Focus tags", [], { max: 60, maxItems: 10, help: "One per line." }),
          },
          SENIOR_TEAM.map((p) => ({
            name: p.name,
            title: p.title,
            creds: p.creds || "",
            photo: positionToFocus(p.photo, p.photoPosition),
            bio: p.bio.join("\n\n"),
            focus: p.focus,
          })),
          { maxItems: 12 },
        ),
      }),
      ...section("Bottom box", {
        ctaTitle: text("Heading", "Want to mentor with us?", { max: 80 }),
        ctaText: long("Text", "Med students and residents can apply. If it looks like a fit, you'll interview with each of us.", { max: 400 }),
        ctaButton: text("Button label", "Apply to mentor", { max: 40 }),
      }),
    },
  },

  becomeMentor: {
    label: "Become a mentor",
    path: "/become-a-mentor",
    fields: {
      ...section("Intro", {
        title: text("Heading", "Mentor the next class of doctors.", { max: 100 }),
        intro: long("Intro", "MentorsMD is invite-only. Every mentor goes through a rigorous interview with each of our senior team members before they receive an invite, so students know anyone they message has real experience and outstanding results.", { max: 800 }),
        applyButton: text("Button label", "Apply to mentor", { max: 40 }),
      }),
      ...section("Perks", {
        perks: list(
          "Perks",
          "Perk",
          { title: text("Title", "", { max: 60, required: true }), body: long("Text", "", { max: 400 }) },
          [
            { title: "Set your own packages", body: "Choose what you offer, your price and your turnaround. Pause any time." },
            { title: "Get paid reliably", body: "Students pay up front. We hold it and release it to you when the work is approved." },
            { title: "Calls on your calendar", body: "Set your weekly hours once. Students book calls in your open times, only after they've paid, and calls happen in a private MentorsMD video room." },
          ],
          { maxItems: 6, help: "Icons follow the order: pen, lock, calendar." },
        ),
      }),
      ...section("How to join", {
        howTitle: text("Heading", "How to join", { max: 60 }),
        steps: lines(
          "Steps",
          [
            "Fill in the short application below: your medical school, residency if you have one, your resume and a few lines about yourself.",
            "If your application looks like a fit, you interview with each of our senior team members.",
            "After the interviews, if you're a fit, we email you a one-time invite link to set up your profile.",
          ],
          { max: 400, maxItems: 8, help: "One step per line. They're numbered automatically." },
        ),
        inviteNote: text("Note next to the button", "Already have an invite? Open the link in your invite email.", { max: 200 }),
      }),
      ...section("Application form", {
        applyTitle: text("Heading", "Apply to mentor", { max: 60 }),
        applyText: long("Text", "Tell us a little about yourself. Our senior team reviews every application and usually replies within a few days.", { max: 400 }),
      }),
    },
  },

  mentors: {
    label: "Mentors (browse)",
    path: "/mentors",
    fields: {
      ...section("Intro", {
        title: text("Heading", "Find your mentor", { max: 60 }),
        intro: text("Intro line", "Every mentor is vetted by our senior team. Message anyone for free.", { max: 200 }),
      }),
      ...section("When there are no mentors yet", {
        emptyTitle: text("Heading", "Mentors are joining soon.", { max: 80 }),
        emptyText: long("Text", "Every mentor goes through a rigorous interview with our senior team, so we add them carefully. Check back soon.", { max: 400 }),
        emptyLink: text("Link to Become a mentor", "Are you a med student or resident? Apply to mentor", { max: 100 }),
      }),
      ...section("“Tell me when mentors join” box (shown with the no-mentors message)", {
        waitlistTitle: text("Heading", "Get an email when mentors join", { max: 80 }),
        waitlistText: long("Text", "Leave your email and we'll let you know as soon as you can book a mentor. No spam, one email.", { max: 300 }),
        waitlistButton: text("Button", "Tell me when mentors join", { max: 40, required: true }),
        waitlistSuccess: long("Thank-you message", "You're on the list. We'll email you as soon as mentors are available.", { max: 300, required: true }),
      }),
    },
  },

  contact: {
    label: "Contact",
    path: "/contact",
    fields: {
      ...section("Contact details", {
        email: text("Email", process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@mentorsmd.com", { max: 120, required: true }),
        phone: text("Phone (optional)", process.env.NEXT_PUBLIC_CONTACT_PHONE || "", { max: 40, help: "The phone card only shows when a number is set." }),
      }),
      ...section("Contact us", {
        title: text("Heading", "Contact us", { max: 60 }),
        intro: long("Intro", "Have a question, ran into an issue, or want to talk to a real person? We usually reply within one business day.", { max: 400 }),
        orderTitle: text("Box 1 heading", "Problem with an order?", { max: 80 }),
        orderText: long("Box 1 text", "Open the order and use “Report a problem” (or “Open a dispute” under a delivery). Payment stays on hold while our team looks into it.", { max: 400 }),
        mentorBoxTitle: text("Box 2 heading", "Want to become a mentor?", { max: 80 }),
        mentorBoxBefore: text("Box 2 text before the link", "Please don't email your resume.", { max: 200 }),
        mentorBoxLink: text("Box 2 link", "Apply with the mentor application form", { max: 100 }),
        mentorBoxAfter: text("Box 2 text after the link", "so our senior team can review it.", { max: 200 }),
      }),
      ...section("Message form", {
        formTitle: text("Heading", "Send us a message", { max: 80 }),
        formIntro: long("Text above the form", "Or write to us here and we'll reply by email.", { max: 300 }),
        formSuccess: long("Thank-you message", "Thanks, your message is on its way. We've emailed you a copy and usually reply within one business day.", { max: 300, required: true }),
      }),
      ...section("Contact page for future mentors (/contact?topic=mentor)", {
        mentorTitle: text("Heading", "Apply to mentor", { max: 60 }),
        mentorIntro: long("Intro", "Mentor applications go through our short application form: your medical school, resume and a few lines about yourself. Our senior team reviews every one and replies within a few days.", { max: 400 }),
      }),
    },
  },

  footer: {
    label: "Footer",
    path: "/",
    fields: {
      ...section("Footer", {
        tagline: text("Tagline under the logo", "Vetted mentors for the road to medical school.", { max: 120 }),
      }),
      ...section("Social links", {
        instagram: link("Instagram", "", { help: "Full address, e.g. https://www.instagram.com/… Hidden when empty." }),
        tiktok: link("TikTok", ""),
        linkedin: link("LinkedIn", ""),
        x: link("X (Twitter)", ""),
        youtube: link("YouTube", ""),
      }),
    },
  },
} satisfies Record<string, { label: string; path: string; fields: Record<string, FieldDef> }>;

export type SitePageKey = keyof typeof SITE_PAGES;
export type PageFields<K extends SitePageKey> = (typeof SITE_PAGES)[K]["fields"];
export type PageValues<K extends SitePageKey> = { [F in keyof PageFields<K>]: ValueOf<PageFields<K>[F]> };
export type StoredValues = Record<string, unknown>;

export const SITE_PAGE_KEYS = Object.keys(SITE_PAGES) as SitePageKey[];
export const isSitePageKey = (k: unknown): k is SitePageKey => typeof k === "string" && Object.prototype.hasOwnProperty.call(SITE_PAGES, k);
export const pageFields = (key: SitePageKey) => SITE_PAGES[key].fields as Record<string, FieldDef>;

export function defaultValues<K extends SitePageKey>(key: K): PageValues<K> {
  const out: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(pageFields(key))) out[name] = structuredClone(f.default);
  return out as PageValues<K>;
}

// ---- checking values --------------------------------------------------------

// Links: a page on this site, or a full http(s)/mailto address. Never
// javascript: or anything else a browser would run.
export function isSafeHref(h: string) {
  return (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\")) || /^https?:\/\/[^\s]+$/i.test(h) || /^mailto:[^\s]+$/i.test(h);
}
export const safeHref = (h: string, fallback = "/") => (isSafeHref(h) ? h : fallback);

// Photos: one of the site's own images, an upload in Supabase Storage
// (public-media bucket, "site/" folder), or an older upload in Vercel Blob.
export function isSafeImage(u: string) {
  const base = stripFocus(u);
  if (!base) return true;
  if (/^\/images\/[A-Za-z0-9._\-/]+$/.test(base) && !base.includes("..")) return true;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:") return false;
    if (url.hostname.endsWith(".public.blob.vercel-storage.com")) return true;
    let supabase = "";
    try {
      supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
    } catch {}
    return (
      !!supabase &&
      `${url.origin}` === supabase &&
      /^\/storage\/v1\/object\/public\/public-media\/(live|preview)\/site\/[A-Za-z0-9._\-/%]+$/.test(url.pathname) &&
      !url.pathname.includes("..") &&
      !url.search
    );
  } catch {
    return false;
  }
}

const clean = (s: string) => s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

function checkScalar(f: ScalarDef, raw: unknown, where: string, errors: string[]): string | string[] {
  if (f.type === "lines") {
    const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split("\n") : [];
    const items = arr.map((x) => clean(String(x ?? "")).replace(/\n/g, " ").trim()).filter(Boolean);
    if (items.length > f.maxItems) errors.push(`${where}: at most ${f.maxItems} lines.`);
    items.forEach((x, i) => {
      if (x.length > f.max) errors.push(`${where}, line ${i + 1}: at most ${f.max} characters.`);
    });
    return items.slice(0, f.maxItems).map((x) => x.slice(0, f.max));
  }
  let v = typeof raw === "string" ? clean(raw) : "";
  v = f.type === "longtext" ? v.trim() : v.replace(/\n/g, " ").trim();
  if (v.length > f.max) errors.push(`${where}: at most ${f.max} characters (now ${v.length}).`);
  if ((f.type === "text" || f.type === "longtext" || f.type === "link") && f.required && !v) errors.push(`${where} can't be empty.`);
  if (f.type === "link" && v && !isSafeHref(v)) errors.push(`${where}: use a page on this site (starting with /) or a full address starting with https://.`);
  if (f.type === "image" && v) {
    if (!isSafeImage(v)) errors.push(`${where}: upload the photo here instead of pasting an address.`);
    else v = withFocus(v, parseFocus(v));
  }
  return v.slice(0, f.max);
}

// Checks everything the admin form sends. Returns the cleaned values (all
// fields) and readable error messages.
export function checkValues<K extends SitePageKey>(key: K, input: unknown): { values: PageValues<K>; errors: string[] } {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const errors: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [name, f] of Object.entries(pageFields(key))) {
    const raw = name in src ? src[name] : f.default;
    if (f.type === "list") {
      const arr = Array.isArray(raw) ? raw : [];
      if (arr.length > f.maxItems) errors.push(`${f.label}: at most ${f.maxItems}.`);
      out[name] = arr.slice(0, f.maxItems).map((item, i) => {
        const it = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const o: Record<string, unknown> = {};
        for (const [sub, sf] of Object.entries(f.fields as Record<string, ScalarDef>)) {
          o[sub] = checkScalar(sf, it[sub], `${f.label} → ${f.itemLabel} ${i + 1} → ${sf.label}`, errors);
        }
        return o;
      });
    } else {
      out[name] = checkScalar(f, raw, f.label, errors);
    }
  }
  return { values: out as PageValues<K>, errors };
}

// Only the fields that differ from the defaults get stored, so untouched
// fields keep following the built-in text.
export function diffFromDefaults(key: SitePageKey, values: Record<string, unknown>): StoredValues {
  const out: StoredValues = {};
  for (const [name, f] of Object.entries(pageFields(key))) {
    if (name in values && JSON.stringify(values[name]) !== JSON.stringify(f.default)) out[name] = values[name];
  }
  return out;
}

// Stored overrides + defaults -> the values a page shows. Anything stored
// that no longer fits the field (e.g. after a code change) falls back to
// the default.
export function resolveValues<K extends SitePageKey>(key: K, stored: unknown): PageValues<K> {
  const values = defaultValues(key) as Record<string, unknown>;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return values as PageValues<K>;
  const s = stored as Record<string, unknown>;
  for (const [name, f] of Object.entries(pageFields(key))) {
    if (!(name in s)) continue;
    const errors: string[] = [];
    if (f.type === "list") {
      if (!Array.isArray(s[name])) continue;
      const { values: one } = checkValues(key, { ...values, [name]: s[name] });
      values[name] = (one as Record<string, unknown>)[name];
    } else {
      const v = checkScalar(f, s[name], f.label, errors);
      if (!errors.length) values[name] = v;
    }
  }
  return values as PageValues<K>;
}

// Plain text -> paragraphs: each line break starts a new one.
export const paragraphs = (s: string) => s.split(/\n+/).map((p) => p.trim()).filter(Boolean);
