// Word and phrase checks for messages, delivery notes and file names.
// Everything here is deliberately conservative: only clear-cut slurs and
// threats are blocked. Mild swearing is allowed. Anything borderline is
// sent to Admin -> Flags for a person to look at, never blocked.
//
// To change a list, edit it here. Matching ignores case, common
// look-alike characters (0 for o, @ for a, $ for s...) and stretched
// letters ("hiiiii").

export type FlagKind =
  | "REPORT"
  | "DISPUTE"
  | "LANGUAGE"
  | "OFF_SITE"
  | "GHOSTWRITING"
  | "CREDENTIALS"
  | "LINK"
  | "AI"
  | "PERFORMANCE"
  | "BLOCKED_MESSAGE";

export type Severity = 1 | 2 | 3;

export type Finding = { kind: FlagKind; severity: Severity; reason: string; matches: string[] };

export type WarningKind = "OFF_SITE" | "GHOSTWRITING" | "CREDENTIALS";

export type TextCheck = {
  // Set when the text must not be sent at all.
  blocked: { reason: string; message: string; matches: string[] } | null;
  // Things to flag for an admin (the message is still sent).
  findings: Finding[];
  // Things the sender is warned about before sending.
  warnings: WarningKind[];
};

// ---------------- Lists ----------------

// Slurs: always blocked. Kept to unambiguous terms only.
const SLURS = [
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "kike", "kikes", "wetback", "wetbacks",
  "raghead", "ragheads", "towelhead", "towelheads", "sandnigger", "beaner", "beaners", "chinaman",
];

// Threats of violence and self-harm encouragement: always blocked.
const THREATS = [
  "i will kill you", "ill kill you", "i'll kill you", "im going to kill you", "i'm going to kill you", "gonna kill you",
  "i will hurt you", "i'll hurt you", "im going to hurt you", "i'm going to hurt you", "gonna hurt you",
  "kill yourself", "kys", "i hope you die", "i know where you live", "i will rape", "rape you", "i will beat you",
  "beat you up",
];

// Borderline: never blocked, flagged (low severity) for a person to judge.
const BORDERLINE_WORDS = [
  "retard", "retarded", "retards", "spaz", "tranny", "trannies", "chink", "gook", "coon", "dyke", "fag", "fags",
  "whore", "slut", "cunt", "twat", "bitch",
];
const BORDERLINE_PHRASES = ["fuck you", "fuck off", "screw you", "go to hell", "shut up idiot", "you idiot", "you're stupid", "you are stupid", "you moron"];

// Medical and academic phrases that contain a listed word but are fine.
// They're removed before the borderline check.
const MEDICAL_ALLOW = [
  "growth retardation", "intrauterine growth retardation", "psychomotor retardation", "mental retardation",
  "flame retardant", "cum laude", "magna cum laude", "summa cum laude", "coon's", "spastic paralysis",
];

// Paying outside MentorsMD. Explicit "let's go around the site" = high.
const OFF_SITE_PAY_HIGH = [
  "pay outside", "pay me outside", "pay you outside", "payment outside", "paying outside", "outside of mentorsmd",
  "outside mentorsmd", "off the platform", "off platform", "off the site", "outside the platform", "outside the site",
  "outside the app", "avoid the fee", "avoid fees", "avoid the fees", "skip the fee", "skip the fees", "save on fees",
  "no fees if", "cheaper if you pay", "pay me directly", "pay you directly", "pay directly", "send me the money",
  "send you the money", "pay me privately", "cash instead",
];
const PAYMENT_APPS = [
  "venmo", "zelle", "paypal", "pay pal", "cashapp", "cash app", "apple pay", "google pay", "gpay", "wire transfer",
  "western union", "moneygram", "bitcoin", "usdt", "wise transfer", "revolut",
];
// Moving the conversation somewhere else.
const CONTACT_APPS = [
  "whatsapp", "whats app", "telegram", "wechat", "snapchat", "snap me", "my snap", "instagram", "my insta", "dm me on",
  "text me", "call me at", "my number is", "my cell", "my phone number", "email me at", "reach me at", "discord", "signal app",
  "kik me", "facetime",
];
const MEETING_LINKS = ["zoom.us", "zoom link", "zoom call", "zoom meeting", "meet.google.com", "google meet", "teams.microsoft.com", "teams.live.com", "microsoft teams", "skype", "calendly", "whereby.com"];

// Asking for (or offering) work that the student must write themselves.
const GHOSTWRITING = [
  "write my essay", "write my personal statement", "write my ps", "write my secondary", "write my secondaries",
  "write my statement", "write my application", "write my activities", "write my most meaningful", "write it for me",
  "write them for me", "write the essay for me", "write the whole", "write the entire", "write my whole", "write my entire",
  "can you write my", "could you write my", "you write it", "you can write it", "i'll write it for you", "i will write it for you",
  "i can write it for you", "i can write your", "i'll write your", "i will write your", "ghostwrite", "ghost write", "ghostwriting",
  "ghost writing", "do my secondaries", "do my essay", "do my application", "fill out my amcas", "fill out my application",
  "submit it for me", "submit my application for me", "take my casper", "take my mcat",
];
// Asking for login details. Always high severity.
const CREDENTIALS = [
  "amcas password", "aacomas password", "tmdsas password", "amcas login", "aacomas login", "tmdsas login",
  "my password is", "the password is", "send me your password", "send your password", "share your password",
  "give me your password", "send me your login", "share your login", "give me your login", "login info", "login information",
  "login details", "login credentials", "log in details", "log in info", "username and password", "user name and password",
  "portal password",
];

// ---------------- Matching ----------------

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

// Lowercase, strip invisible characters, undo look-alikes and fancy quotes.
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function deLeet(text: string) {
  return text.replace(/[013457@$!]/g, (c) => LEET[c] || c);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A word/phrase as a regex: whole words only, letters may be stretched
// ("fuuuck"), spaces may be any run of spaces/punctuation.
function phraseRe(phrase: string) {
  const body = phrase
    .split(" ")
    .map((w) => w.split("").map((c) => (/[a-z]/.test(c) ? `${escapeRe(c)}+` : escapeRe(c))).join(""))
    .join("[\\s._*-]+");
  return new RegExp(`(?<![a-z])${body}(?![a-z])`, "i");
}

const cache = new Map<string, RegExp>();
function re(phrase: string) {
  let r = cache.get(phrase);
  if (!r) {
    r = phraseRe(phrase);
    cache.set(phrase, r);
  }
  return r;
}

function findAll(text: string, list: string[]): string[] {
  const out: string[] = [];
  for (const p of list) {
    const m = text.match(re(p));
    if (m) out.push(m[0]);
  }
  return Array.from(new Set(out));
}

// Contact details typed into a message.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// US-style phone numbers, with or without +1 / brackets / separators.
const PHONE_RE = /(?<!\d)(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;
// A cash-app style handle like $janedoe.
const CASHTAG_RE = /(?<![\w$])\$[a-z][a-z0-9_]{2,19}\b/gi;

export function contactDetails(text: string): string[] {
  const out = [...(text.match(EMAIL_RE) || []), ...(text.match(PHONE_RE) || []).filter((p) => p.replace(/\D/g, "").length >= 10)];
  return Array.from(new Set(out.map((s) => s.trim())));
}

// The full check. `context` changes nothing about blocking, but file
// names only get the contact-detail check (a file called
// "essay_jane.doe@example.com.pdf" is how contact info slips through).
export function checkText(raw: string, context: "message" | "delivery" | "filename" = "message"): TextCheck {
  const result: TextCheck = { blocked: null, findings: [], warnings: [] };
  if (!raw || !raw.trim()) return result;
  const text = normalize(raw);

  if (context === "filename") {
    const contact = contactDetails(text.replace(/_/g, " "));
    if (contact.length) {
      result.findings.push({ kind: "OFF_SITE", severity: 1, reason: "Contact details in a file name", matches: contact });
    }
    return result;
  }

  const plain = deLeet(text);

  // 1. Blocked outright.
  const slurs = findAll(plain, SLURS);
  const threats = findAll(text, THREATS).concat(findAll(plain, THREATS));
  if (slurs.length || threats.length) {
    const matches = Array.from(new Set([...slurs, ...threats]));
    result.blocked = {
      reason: threats.length ? "Threat of violence" : "Slur",
      message: threats.length
        ? "This message wasn't sent: it reads as a threat. Please keep messages respectful. See our Community Guidelines."
        : "This message wasn't sent because it contains a slur. Please keep messages respectful. See our Community Guidelines.",
      matches,
    };
    return result;
  }

  // 2. Borderline language: flag only.
  let allowed = plain;
  for (const p of MEDICAL_ALLOW) allowed = allowed.replace(new RegExp(escapeRe(p), "gi"), " ");
  const borderline = [...findAll(allowed, BORDERLINE_WORDS), ...findAll(allowed, BORDERLINE_PHRASES)];
  if (borderline.length) {
    result.findings.push({ kind: "LANGUAGE", severity: 1, reason: "Possibly offensive language", matches: borderline });
  }

  // 3. Paying or talking outside MentorsMD.
  const payHigh = findAll(text, OFF_SITE_PAY_HIGH);
  const payApps = [...findAll(text, PAYMENT_APPS), ...(raw.match(CASHTAG_RE) || [])];
  if (payHigh.length) {
    result.findings.push({ kind: "OFF_SITE", severity: 3, reason: "Asked to pay outside MentorsMD", matches: [...payHigh, ...payApps] });
  } else if (payApps.length) {
    result.findings.push({ kind: "OFF_SITE", severity: 2, reason: "Mentioned a payment app", matches: payApps });
  }
  const contact = [...contactDetails(text), ...findAll(text, CONTACT_APPS)];
  if (contact.length) {
    result.findings.push({ kind: "OFF_SITE", severity: 1, reason: "Shared contact details or another app", matches: contact });
  }
  const meetings = findAll(text, MEETING_LINKS);
  if (meetings.length) {
    result.findings.push({ kind: "OFF_SITE", severity: 1, reason: "Outside meeting link (calls should use MentorsMD video)", matches: meetings });
  }
  if (payHigh.length || payApps.length || contact.length || meetings.length) result.warnings.push("OFF_SITE");

  // 4. Ghostwriting and login details.
  const ghost = findAll(text, GHOSTWRITING);
  if (ghost.length) {
    result.findings.push({ kind: "GHOSTWRITING", severity: 2, reason: "Possible ghostwriting request", matches: ghost });
    result.warnings.push("GHOSTWRITING");
  }
  const creds = findAll(text, CREDENTIALS);
  if (creds.length) {
    result.findings.push({ kind: "CREDENTIALS", severity: 3, reason: "Asked for or shared login details", matches: creds });
    result.warnings.push("CREDENTIALS");
  }

  return result;
}

// What the sender sees before a flagged message goes out.
export const WARNING_TEXT: Record<WarningKind, string> = {
  OFF_SITE:
    "Keep payments and calls on MentorsMD. Paying or meeting outside the site means no payment protection, no refunds and no help from our team if something goes wrong, and it's against our Community Guidelines.",
  GHOSTWRITING:
    "Mentors give feedback and guidance. They can't write essays or applications for students. Schools treat ghostwritten work as dishonest, and it's against our Community Guidelines.",
  CREDENTIALS:
    "Never share passwords or login details (AMCAS, AACOMAS, TMDSAS, email or anything else). No mentor or MentorsMD staff member will ever need them.",
};
