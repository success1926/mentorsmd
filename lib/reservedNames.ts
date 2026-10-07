// Names nobody can use as their display name, so no one can pose as
// MentorsMD staff in messages. Real staff show an "MentorsMD staff"
// badge instead (admin accounts only).
const RESERVED_WORDS = [
  "admin", "admins", "administrator", "administrators", "moderator", "moderators", "staff", "support",
  "helpdesk", "official", "sysadmin", "mentorsmd",
];
// Whole names (after removing spaces/punctuation) that are reserved too.
const RESERVED_JOINED = ["mentorsmd", "mentorsmdteam", "mentorsmdsupport", "mentorsmdstaff", "mentorsmdadmin", "customerservice", "customersupport", "trustandsafety"];

const LOOKALIKE: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "|": "l" };

function clean(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/[013457@$|]/g, (c) => LOOKALIKE[c] || c);
}

export function isReservedName(name: string): boolean {
  const c = clean(name);
  const joined = c.replace(/[^a-z]/g, "");
  if (!joined) return false;
  if (joined.includes("mentorsmd") || RESERVED_JOINED.some((r) => joined === r || joined.includes(r))) return true;
  const words = c.split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => RESERVED_WORDS.includes(w));
}

export const RESERVED_NAME_ERROR = "That name can't be used. Words like MentorsMD, Admin, Support or Staff are reserved so nobody can pose as our team. Please use your real name.";
